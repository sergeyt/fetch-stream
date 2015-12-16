import fetch from '../src';

$(() => {
	fetch('/stream', (page, i) => {
		const doc = $('<div/>');
		doc.html(page);
		doc.appendTo($('#root'));
		return i < 50;
	});
});
