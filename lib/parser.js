'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = makeParser;
var BUFFER = exports.BUFFER = 'BUFFER';
var BYTEARRAY = exports.BYTEARRAY = 'BYTEARRAY';

var isnode = typeof module !== 'undefined' && module.exports;

var CR = '\r'.charCodeAt(0);
var LF = '\n'.charCodeAt(0);
var D0 = '0'.charCodeAt(0);
var D9 = '9'.charCodeAt(0);
var LA = 'a'.charCodeAt(0);
var LZ = 'z'.charCodeAt(0);
var UA = 'A'.charCodeAt(0);
var UZ = 'Z'.charCodeAt(0);

var errBadFormat = 'bad format';

function ishex(c) {
	return c >= D0 && c <= D9 || c >= LA && c <= LZ || c >= UA && c <= UZ;
}

/**
 * Makes UTF8 decoding function.
 * @param  {Boolean} [chunkType] Specifies type of input chunks.
 * @return {Function} The function to decode byte chunks.
 */
function makeDecoder(chunkType) {
	switch (chunkType) {
		case BUFFER:
			return function (buf) {
				return buf.toString('utf8');
			};
		default:
			if (isnode) {
				return function (a) {
					return new Buffer(a).toString('utf8');
				};
			}
			var decoder = null;
			return function (buf) {
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
			return function (a, b) {
				return Buffer.concat([a, b]);
			};
		default:
			return function (a, b) {
				// console.log('[%d, %d]', a.length, b.length);
				var t = new Uint8Array(a.length + b.length);
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
function makeParser(callback, chunkType) {
	var decode = makeDecoder(chunkType);
	var concat = makeConcat(chunkType);

	var STATE_HEADER = 0;
	var STATE_BODY = 1;
	var STATE_ERROR = 2;

	var index = 0;
	var state = STATE_HEADER;
	var header = '';
	var body = null;
	var bodySize = 0;
	var expectLF = false;

	function readHeader(chunk) {
		// read header line until CRLF
		var i = 0;
		for (; i < chunk.length; i++) {
			var c = chunk[i];
			if (expectLF) {
				if (c !== LF) {
					state = STATE_ERROR;
					callback(null, new Error(errBadFormat));
					return -1;
				}
				expectLF = false;
				if (header.length === 0) {
					// end of chunk!
					continue;
				}
				return i + 1;
			}
			if (c === CR) {
				expectLF = true;
				continue;
			}
			// expect at start size of block in hex
			if (header.length === 0 && !ishex(c)) {
				state = STATE_ERROR;
				callback(null, errBadFormat);
				return -1;
			}
			header += String.fromCharCode(c);
		}
		return -1;
	}

	function parse(chunk) {
		switch (state) {
			case STATE_ERROR:
				throw new Error('unexpected call after error');

			case STATE_HEADER:
				var headerSize = readHeader(chunk);
				if (headerSize < 0) {
					return undefined;
				}

				// ignore chunk extensions
				var i = header.indexOf(';');
				bodySize = parseInt(i >= 0 ? header.substr(0, i) : header, 16);

				if (bodySize === 0) {
					// notify complete!
					return callback({ done: true, index: index });
				}

				var chunkSize = headerSize + bodySize;
				if (chunk.length < chunkSize) {
					state = STATE_BODY;
					body = chunk.slice(headerSize);
					return undefined;
				}

				var head = chunk.slice(headerSize, headerSize + bodySize);
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

				var h = chunk.slice(0, bodySize - body.length);
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