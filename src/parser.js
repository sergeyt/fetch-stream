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

/**
 * Makes parser function to process chunk stream.
 * @param  {Function} [callback] The function to process parsed text fragment.
 * @param  {Boolean}  [chunkType] Specifies type of input chunks.
 */
export default function makeParser(callback, chunkType) {
	const decode = makeDecoder(chunkType);
	const concat = makeConcat(chunkType);

	const STATE_HEADER = 0;
	const STATE_BODY = 1;

	let index = 0;
	let state = STATE_HEADER;
	let header = '';
	let body = null;
	let bodySize = 0;
	let expectLF = false;

	function readHeader(chunk) {
		// read header line until CRLF
		let i = 0;
		for (; i < chunk.length; i++) {
			if (expectLF) {
				if (chunk[i] !== LF) {
					// raise error!
					console.log('bang');
				}
				expectLF = false;
				if (header.length === 0) {
					continue;
				}
				return i + 1;
			}
			if (chunk[i] === CR) {
				expectLF = true;
			} else {
				header += String.fromCharCode(chunk[i]);
			}
		}
		return -1;
	}

	function parse(chunk) {
		switch (state) {
		case STATE_HEADER:
			const headerSize = readHeader(chunk);
			if (headerSize < 0) {
				return undefined;
			}

			// ignore chunk extensions
			const i = header.indexOf(';');
			bodySize = parseInt(i >= 0 ? header.substr(0, i) : header, 16);

			if (bodySize === 0) {
				// notify complete!
				return callback({ done: true, index });
			}

			const chunkSize = headerSize + bodySize;
			if (chunk.length < chunkSize) {
				state = STATE_BODY;
				body = chunk.slice(headerSize);
				return undefined;
			}

			const head = chunk.slice(headerSize, headerSize + bodySize);
			if (callback({ value: decode(head), index: index++ }) === false) {
				return false;
			}

			header = '';
			return chunkSize < chunk.length ? parse(chunk.slice(chunkSize)) : undefined;

			// incomplete body
		default:
			if (body.length + chunk.length < bodySize) {
				body = concat(body, chunk);
				return undefined;
			}

			const h = chunk.slice(0, bodySize - body.length);
			body = concat(body, h);
			if (callback({ value: decode(body), index: index++ }) === false) {
				return false;
			}

			state = STATE_HEADER;
			header = '';
			body = null;
			bodySize = 0;
			return parse(chunk.slice(h.length));
		}
	}
	return parse;
}
