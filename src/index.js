import http from 'stream-http';

function isFunction(value) {
	return typeof value === 'function';
}

const supportFetch = isFunction(global.fetch) && isFunction(global.ReadableByteStream);
const CR = '\r'.charCodeAt(0);
const LF = '\n'.charCodeAt(0);

function makeDecoder(isBuffer) {
	if (isBuffer) {
		return (buf) => buf.toString('utf8');
	}
	let decoder = null;
	return (buf) => {
		if (!decoder) {
			decoder = new TextDecoder();
		}
		return decoder.decode(buf);
	};
}

function makeConcat(isBuffer) {
	if (isBuffer) {
		return (a, b) => Buffer.concat([a, b]);
	}
	return (a, b) => {
		const t = new Uint8Array(a.length + b.length);
		t.set(a);
		t.set(b, a.length);
		return t;
	};
}

function makeParser(callback, isBuffer) {
	let prev = null;
	let index = 0;
	const decode = makeDecoder(isBuffer);
	const concat = makeConcat(isBuffer);
	return (data) => {
		let chunk = data;
		if (prev !== null) {
			chunk = concat(prev, chunk);
		}

		// read line until CRLF
		let header = '';
		for (let i = 0; i + 1 < chunk.length; i++) {
			if (chunk[i] === CR && chunk[i + 1] === LF) {
				break;
			}
			header += String.fromCharCode(chunk[i]);
		}

		const headerSize = header.length + 2;
		// ignore chunk extensions
		const i = header.indexOf(';');
		const size = parseInt(i >= 0 ? header.substr(0, i) : header, 16);
		const chunkSize = headerSize + size + 2;

		if (size === 0) {
			return undefined;
		}

		if (chunk.length >= chunkSize) {
			prev = chunkSize < chunk.length ? chunk.slice(chunkSize) : null;
			const head = chunk.slice(headerSize, size);
			const text = decode(head);
			return callback(text, index++);
		}

		prev = chunk;
		return undefined;
	};
}

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

export default function fetchStream(options = {}, callback) {
	const url = typeof options === 'string' ? options : options.url || options.path;
	if (supportFetch) {
		// TODO support Request object?
		const init = typeof options === 'object' ? options : {};
		fetch(url, init).then((res) => {
			pump(res.body.getReader(), makeParser(callback, false));
		});
	} else {
		const parser = makeParser(callback, true);
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
}

// expose global for apps without modules
window.fetchStream = fetchStream;
