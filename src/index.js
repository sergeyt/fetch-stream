import http from 'stream-http';
import makeParser, { BUFFER } from './parser';

function noop() {}

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
	let rollback = noop;
	return {
		read() {
			if (chunks.length > 0) {
				return Promise.resolve(chunks.shift());
			}
			if (completed) {
				return Promise.reject('eof');
			}
			// TODO prevent multiple calls?
			return new Promise((resolve, reject) => {
				commit = () => {
					commit = noop;
					resolve(chunks.shift());
				};
				rollback = (err) => {
					rollback = noop;
					reject(err);
				};
			});
		},

		cancel() {
			cancelled = true;
		},

		handler(chunk, err) {
			if (cancelled) return cancelled;
			if (err) {
				completed = true;
				rollback(err);
				return false;
			}
			completed = !!chunk.done;
			chunks.push(chunk);
			commit();
			return undefined;
		},
	};
}

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
			if (res.status >= 200 && res.status < 300) {
				pump(res.body.getReader(), makeParser(cb));
			} else {
				// TODO read custom error payload
				cb(null, { status: res.status, statusText: res.statusText });
			}
		}, (err) => {
			cb(null, err);
		});
	} else {
		const parser = makeParser(cb, BUFFER);
		options.path = url;
		const req = http.get(options, (res) => {
			const status = res.status || res.statusCode;
			if (!(status >= 200 && status < 300)) {
				// TODO read custom error payload
				cb(null, { status, statusText: res.statusText || res.statusMessage });
				return;
			}

			res.on('data', (buf) => {
				if (parser(buf) === false) {
					// cancelling
					req.abort();
				}
			});

			res.on('error', err => {
				req.abort();
				cb(null, err);
			});
		});
	}
	return stream;
}

// expose global for apps without modules
window.fetchStream = fetchStream;

// export parser for any reuse
export { makeParser };
