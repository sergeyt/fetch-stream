'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = fetchStream;

var _streamHttp = require('stream-http');

var _streamHttp2 = _interopRequireDefault(_streamHttp);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function isFunction(value) {
	return typeof value === 'function';
}

var supportFetch = isFunction(global.fetch) && isFunction(global.ReadableByteStream);
var CR = '\r'.charCodeAt(0);
var LF = '\n'.charCodeAt(0);

function makeDecoder(isBuffer) {
	if (isBuffer) {
		return function (buf) {
			return buf.toString('utf8');
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

function makeConcat(isBuffer) {
	if (isBuffer) {
		return function (a, b) {
			return Buffer.concat([a, b]);
		};
	}
	return function (a, b) {
		var t = new Uint8Array(a.length + b.length);
		t.set(a);
		t.set(b, a.length);
		return t;
	};
}

function makeParser(callback, isBuffer) {
	var prev = null;
	var decode = makeDecoder(isBuffer);
	var concat = makeConcat(isBuffer);
	return function (data) {
		var chunk = data;
		if (prev !== null) {
			chunk = concat(prev, chunk);
		}

		// read line until CRLF
		var str = '';
		for (var i = 0; i + 1 < chunk.length; i++) {
			if (chunk[i] === CR && chunk[i + 1] === LF) {
				break;
			}
			str += String.fromCharCode(chunk[i]);
		}

		var headerSize = str.length + 2;
		var size = parseInt(str, 16);
		var chunkSize = headerSize + size + 2;

		if (size === 0) {
			return;
		}

		if (chunk.length >= chunkSize) {
			prev = chunkSize < chunk.length ? chunk.slice(chunkSize) : null;
			var head = chunk.slice(headerSize, size);
			var text = decode(head);
			callback(text);
		} else {
			prev = chunk;
		}
	};
}

// reads all chunks
function pump(reader, handler) {
	reader.read().then(function (result) {
		if (result.done) {
			return;
		}
		handler(result.value);
		pump(reader, handler);
	});
}

// TODO support cancel, e.g. callback returns false
// TODO support POST method

function fetchStream() {
	var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
	var callback = arguments[1];

	var url = typeof options === 'string' ? options : options.url || options.path;
	if (supportFetch) {
		// TODO support Request object?
		var init = (typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object' ? options : {};
		fetch(url, init).then(function (res) {
			pump(res.body.getReader(), makeParser(callback, false));
		});
	} else {
		(function () {
			var parser = makeParser(callback, true);
			options.path = url;
			_streamHttp2.default.get(options, function (res) {
				res.on('data', function (buf) {
					parser(buf);
				});
				res.on('end', function () {});
			});
		})();
	}
}

// expose global for apps without modules
window.fetchStream = fetchStream;