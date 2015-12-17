'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = fetchStream;

var _streamHttp = require('stream-http');

var _streamHttp2 = _interopRequireDefault(_streamHttp);

var _parser = require('./parser');

var _parser2 = _interopRequireDefault(_parser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj; }

function noop() {}

function isFunction(value) {
	return typeof value === 'function';
}

var supportFetch = isFunction(global.fetch) && isFunction(global.ReadableByteStream);

// reads all chunks
function pump(reader, handler) {
	reader.read().then(function (result) {
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
	var chunks = [];
	var cancelled = false;
	var completed = false;
	var commit = noop;
	return {
		read: function read() {
			if (chunks.length > 0) {
				return Promise.resolve(chunks.shift());
			}
			if (completed) {
				return Promise.reject('eof');
			}
			// TODO prevent multiple calls?
			return new Promise(function (resolve) {
				commit = function () {
					commit = noop;
					resolve(chunks.shift());
				};
			});
		},
		cancel: function cancel() {
			cancelled = true;
		},
		handler: function handler(chunk) {
			if (cancelled) return cancelled;
			completed = !!chunk.done;
			chunks.push(chunk);
			commit();
			return undefined;
		}
	};
}

// TODO error handling

/**
 * Fetches resource stream.
 * @param  {object} [options] URL or options of request.
 * @param  {function} [callback] The callback to process each chunk in the stream.
 */
function fetchStream() {
	var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
	var callback = arguments[1];

	var cb = callback;
	var stream = null;
	if (cb === undefined) {
		stream = makeStream();
		cb = stream.handler;
	}
	var url = typeof options === 'string' ? options : options.url || options.path;
	if (supportFetch) {
		// TODO support Request object?
		var init = (typeof options === 'undefined' ? 'undefined' : _typeof(options)) === 'object' ? options : {};
		fetch(url, init).then(function (res) {
			pump(res.body.getReader(), (0, _parser2.default)(cb));
		});
	} else {
		(function () {
			var parser = (0, _parser2.default)(cb, _parser.BUFFER);
			options.path = url;
			var req = _streamHttp2.default.get(options, function (res) {
				res.on('data', function (buf) {
					if (parser(buf) === false) {
						// cancelling
						req.abort();
					}
				});
			});
		})();
	}
	return stream;
}

// expose global for apps without modules
window.fetchStream = fetchStream;