import fetch from '../src';

$(() => {
	fetch('/stream', (result, i) => {
		if (result.done) {
			console.log('completed');
			return false;
		}
		const doc = $('<div/>');
		doc.html(result);
		doc.appendTo($('#root'));
		return i < 50;
	});
});
