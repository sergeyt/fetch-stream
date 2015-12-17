const isnode = typeof module !== 'undefined' && module.exports;

const CR = '\r'.charCodeAt(0);
const LF = '\n'.charCodeAt(0);

export const BUFFER = 'BUFFER';
export const BYTEARRAY = 'BYTEARRAY';

/**
 * Makes UTF8 decoding function.
 * @param  {Boolean} [chunkType] Specifies type of input chunks.
 * @return {Function} The function to decode byte chunks.
 */
function makeDecoder(chunkType) {
	switch (chunkType) {
	case BUFFER:
		return (buf) => buf.toString('utf8');
	default:
		if (isnode) {
			return a => new Buffer(a).toString('utf8');
		}
		let decoder = null;
		return (buf) => {
			if (!decoder) {
				decoder = new TextDecoder();
			}
			return decoder.decode(buf);
		};
	}
}

/**
 * Makes function to concat two byte chunks.
 * @param  {Boolean} [chunkType] Specifies type of input chunks.
 * @return {Function} The function to concat two byte chunks.
 */
function makeConcat(chunkType) {
	switch (chunkType) {
	case BUFFER:
		return (a, b) => Buffer.concat([a, b]);
	default:
		return (a, b) => {
			// console.log('[%d, %d]', a.length, b.length);
			const t = new Uint8Array(a.length + b.length);
			t.set(a);
			t.set(b, a.length);
			// console.log('%d: %s', t.length, new Buffer(t).toString('utf8'));
			return t;
		};
	}
}

// TODO make it faster with state machine

/**
 * Makes parser function to process chunk stream.
 * @param  {Function} [callback] The function to process parsed text fragment.
 * @param  {Boolean}  [chunkType] Specifies type of input chunks.
 */
export default function makeParser(callback, chunkType) {
	let prev = null;
	let index = 0;
	const decode = makeDecoder(chunkType);
	const concat = makeConcat(chunkType);
	function parse(data) {
		let chunk = data;
		if (prev !== null) {
			chunk = concat(prev, chunk);
			prev = null;
		}

		// read header line until CRLF
		let header = '';
		let hasHeader = false;
		for (let i = 0; i + 1 < chunk.length; i++) {
			if (chunk[i] === CR && chunk[i + 1] === LF) {
				hasHeader = true;
				break;
			}
			header += String.fromCharCode(chunk[i]);
		}

		if (!hasHeader) {
			prev = chunk;
			return undefined;
		}

		const headerSize = header.length + 2;
		// ignore chunk extensions
		const i = header.indexOf(';');
		const size = parseInt(i >= 0 ? header.substr(0, i) : header, 16);

		if (size === 0) {
			// notify complete!
			callback({ done: true, index });
			return undefined;
		}

		const chunkSize = headerSize + size + 2;
		if (chunk.length >= chunkSize) {
			const next = chunkSize < chunk.length ? chunk.slice(chunkSize) : null;
			const head = chunk.slice(headerSize, headerSize + size);
			const text = decode(head);
			if (callback({ value: text, index: index++ }) === false) {
				return false;
			}
			return next !== null ? parse(next) : undefined;
		}

		prev = chunk;
		return undefined;
	}
	return parse;
}
