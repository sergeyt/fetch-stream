// import test from 'ava';
import makeParser from '../src/parser';
import expect from 'expect.js';
import SmartBuffer from 'smart-buffer';

function makeArray(buf, start, end) {
	const ab = new ArrayBuffer(end - start);
	const view = new Uint8Array(ab);
	for (let i = start, j = 0; i < end; i++, j++) {
		view[j] = buf[i];
	}
	return view;
}

function makeChunks(n = 3, size = 16) {
	const buf = new SmartBuffer();
	for (let i = 0; i < n; i++) {
		const t = `chunk${i + 1}`;
		buf.writeString(`00${t.length.toString(16)};key=value\r\n${t}\r\n`);
	}
	buf.writeString('0\r\n\r\n');
	const buffer = buf.toBuffer();
	const chunks = [];
	for (let i = 0; i < buffer.length; i += size) {
		const chunk = makeArray(buffer, i, Math.min(buffer.length, i + size));
		chunks.push(chunk);
	}
	return chunks;
}

function basicTest(n, size) {
	const chunks = [];
	const parser = makeParser(d => {
		if (d.done) {
			return;
		}
		chunks.push(d.value);
	});

	makeChunks(n, size).forEach(d => {
		parser(d);
	});

	expect(chunks.length).to.be(n);

	for (let i = 0; i < n; i++) {
		expect(chunks[i]).to.be(`chunk${i + 1}`);
	}
}

describe('parser', () => {
	it('chunks3size4', () => {
		basicTest(3, 4);
	});
	it('chunks3size8', () => {
		basicTest(3, 8);
	});
	it('chunks3size11', () => {
		basicTest(3, 11);
	});
	it('chunks3size16', () => {
		basicTest(3, 16);
	});
});

// ava tests
// test(function chunks3size4(t) {
// 	basicTest(t, 3, 4);
// });
//
// test(function chunks3size8(t) {
// 	basicTest(t, 3, 8);
// });
//
// test(function chunks3size11(t) {
// 	basicTest(t, 3, 11);
// });
//
// test(function chunks3size16(t) {
// 	basicTest(t, 3, 16);
// });
