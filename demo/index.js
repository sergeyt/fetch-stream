import fetch from '../src';

$(() => {
	fetch('/stream', page => {
		const doc = $('<div/>');
		doc.html(page);
		doc.appendTo($('#root'));
	});
});
