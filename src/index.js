let decoder = null;

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

		// TODO read line until CRLF
		const headerSize = 10;
		const sizeStr = decoder.decode(chunk.slice(0, 8));
		const size = parseInt(sizeStr, 16);
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
