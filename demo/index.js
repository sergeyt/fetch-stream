import fetch from '../src';

const useCallback = false;

const handler = (result) => {
	if (result.done) {
		console.log('completed');
		return false;
	}
	const doc = $('<div/>');
	doc.html(result.value);
	doc.appendTo($('#root'));
	return result.index < 50;
};

$(() => {
	if (useCallback) {
		fetch('/stream', handler);
	} else {
		const stream = fetch('/stream');
		const readNext = () => {
			stream.read().then(t => {
				if (t.done) {
					return;
				}
				if (handler(t) === false) {
					stream.cancel();
					return;
				}
				readNext();
			});
		};
		readNext();
	}
});
