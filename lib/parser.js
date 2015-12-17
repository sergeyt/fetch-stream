'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = makeParser;
var CR = '\r'.charCodeAt(0);
var LF = '\n'.charCodeAt(0);

var BUFFER = exports.BUFFER = 'BUFFER';
var UINT8ARRAY = exports.UINT8ARRAY = 'UINT8ARRAY';

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
				var t = new Uint8Array(a.length + b.length);
				t.set(a);
				t.set(b, a.length);
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
	var prev = null;
	var index = 0;
	var decode = makeDecoder(chunkType);
	var concat = makeConcat(chunkType);
	function parse(data) {
		var chunk = data;
		if (prev !== null) {
			chunk = concat(prev, chunk);
			prev = null;
		}

		// read line until CRLF
		var header = '';
		for (var _i = 0; _i + 1 < chunk.length; _i++) {
			if (chunk[_i] === CR && chunk[_i + 1] === LF) {
				break;
			}
			header += String.fromCharCode(chunk[_i]);
		}

		var headerSize = header.length + 2;
		// ignore chunk extensions
		var i = header.indexOf(';');
		var size = parseInt(i >= 0 ? header.substr(0, i) : header, 16);
		var chunkSize = headerSize + size + 2;

		if (size === 0) {
			// notify complete!
			callback({ done: true, index: index });
			return undefined;
		}

		if (chunk.length >= chunkSize) {
			var next = chunkSize < chunk.length ? chunk.slice(chunkSize) : null;
			var head = chunk.slice(headerSize, size);
			var text = decode(head);
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