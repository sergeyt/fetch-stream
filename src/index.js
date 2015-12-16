let decoder = null;

const CR = '\r'.charCodeAt(0);
const LF = '\n'.charCodeAt(0);

function makeLoader(callback) {
	let prev = null;
	return (data) => {
		let chunk = data;
		if (prev !== null) {
			const t = new Uint8Array(prev.length + chunk.length);
			t.set(prev);
			t.set(chunk, prev.length);
			chunk = t;
		}

		if (!decoder) {
			decoder = new TextDecoder();
		}

		// read line until CRLF
		let str = '';
		for (let i = 0; i + 1 < chunk.length; i++) {
			if (chunk[i] === CR && chunk[i + 1] === LF) {
				break;
			}
			str += String.fromCharCode(chunk[i]);
		}

		const headerSize = str.length + 2;
		const size = parseInt(str, 16);
		const chunkSize = headerSize + size + 2;

		if (chunk.length >= chunkSize) {
			prev = chunkSize < chunk.length ? chunk.slice(chunkSize) : null;
			const head = chunk.slice(headerSize, size);
			const text = decoder.decode(head);
			callback(text);
		} else {
			prev = chunk;
		}
	};
}

function pump(reader, handler) {
	reader.read().then(result => {
		if (result.done) {
			return;
		}
		handler(result.value);
		pump(reader, handler);
	});
}

export default function fetchStream(url, options = {}, callback) {
	// TODO this is only works in chrome 43+
	fetch(url, options).then((res) => {
		const loader = makeLoader(callback);
		pump(res.body.getReader(), loader);
	});
}
