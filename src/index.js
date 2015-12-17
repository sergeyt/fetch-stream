import http from 'stream-http';
import makeParser, { BUFFER } from './parser';

function noop() {
}

function isFunction(value) {
	return typeof value === 'function';
}

const supportFetch = isFunction(global.fetch) && isFunction(global.ReadableByteStream);

// reads all chunks
function pump(reader, handler) {
	reader.read().then(result => {
		if (result.done) {
			return;
		}
		if (handler(result.value) === false) {
			// cancelling
			return;
		}
		pump(reader, handler);
	});
}

function makeStream() {
	const chunks = [];
	let cancelled = false;
	let completed = false;
	let commit = noop;
	return {
		read() {
			if (chunks.length > 0) {
				return Promise.resolve(chunks.shift());
			}
			if (completed) {
				return Promise.reject('eof');
			}
			// TODO prevent multiple calls?
			return new Promise((resolve) => {
				commit = () => {
					commit = noop;
					resolve(chunks.shift());
				};
			});
		},

		cancel() {
			cancelled = true;
		},

		handler(chunk) {
			if (cancelled) return cancelled;
			completed = !!chunk.done;
			chunks.push(chunk);
			commit();
			return undefined;
		},
	};
}

// TODO error handling

/**
 * Fetches resource stream.
 * @param  {object} [options] URL or options of request.
 * @param  {function} [callback] The callback to process each chunk in the stream.
 */
export default function fetchStream(options = {}, callback) {
	let cb = callback;
	let stream = null;
	if (cb === undefined) {
		stream = makeStream();
		cb = stream.handler;
	}
	const url = typeof options === 'string' ? options : options.url || options.path;
	if (supportFetch) {
		// TODO support Request object?
		const init = typeof options === 'object' ? options : {};
		fetch(url, init).then((res) => {
			pump(res.body.getReader(), makeParser(cb));
		});
	} else {
		const parser = makeParser(cb, BUFFER);
		options.path = url;
		const req = http.get(options, (res) => {
			res.on('data', (buf) => {
				if (parser(buf) === false) {
					// cancelling
					req.abort();
				}
			});
		});
	}
	return stream;
}

// expose global for apps without modules
window.fetchStream = fetchStream;
