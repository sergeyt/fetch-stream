[![Build Status](https://travis-ci.org/sergeyt/fetch-stream.svg)](https://travis-ci.org/sergeyt/fetch-stream)
[![codecov.io](https://codecov.io/github/sergeyt/fetch-stream/coverage.svg?branch=master)](https://codecov.io/github/sergeyt/fetch-stream?branch=master)

# fetch-stream

Easy fetch of HTTP/1.1 chunked content.

## Basic usage

```js
import fetchStream from 'fetch-stream';

const handler = (result) => {
	if (result.done) {
		console.log('completed');
		return;
	}
	console.log(result.value);
	return i < 100; // return false to cancel
};

fetchStream('/api/stream', handler);
```

## Usage of stream API

```js
import fetchStream from 'fetch-stream';

const handler = (result) => {
	if (result.done) {
		console.log('completed');
		return;
	}
	console.log(result.value);
	return i < 100; // return false to cancel
};

const stream = fetchStream('/api/stream');

const pump = () => {
	stream.read().then((result) => {
		if (result.done) {
			return;
		}
		if (handler(result) === false) {
			stream.cancel();
			return;
		}
		pump();
	});
};

// process all chunks
pump();
```
