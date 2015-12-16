# fetch-stream

Easy fetch of HTTP/1.1 chunked content.

## Usage

```js
import fetchStream from 'fetch-stream';

fetchStream('/api/stream', (block, i) => {
	console.log(block);
	return i < 100; // return false to cancel
});
```
