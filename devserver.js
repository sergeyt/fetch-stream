process.env.UV_THREADPOOL_SIZE = 100;

const express = require('express');
const faker = require('faker');
const webpack = require('webpack');
const config = require('./webpack.config');

const port = 8000;
const app = express();
const compiler = webpack(config);

app.use(express.static(process.cwd()));

app.use(require('webpack-dev-middleware')(compiler, {
	noInfo: true,
	publicPath: config.output.publicPath,
}));

app.use(require('webpack-hot-middleware')(compiler));

app.get('/error', (req, res) => {
	res.status(500).send({
		error: 'bang',
	});
});

app.get('/stream', (req, res) => {
	res.writeHead(200, {
		'Content-Type': 'text/html',
		'Transfer-Encoding': 'chunked',
		'Cache-Control': 'no-cache',
	});

	function chunk(i) {
		const text = faker.lorem.paragraph();
		const html = `<html><h1>chunk #${i}</h1><p>${text}</p></html>`;
		const data = `00${html.length.toString(16)};name=value\r\n${html}\r\n`;
		res.write(data);
		if (i < 100) {
			setTimeout(() => {
				chunk(i + 1);
			}, 100);
		} else {
			res.write('0\r\n\r\n');
		}
	}

	setTimeout(() => {
		chunk(1);
	}, 100);
});

app.listen(port, '0.0.0.0', (err) => {
	if (err) {
		console.log(err);
		return;
	}

	console.log('Listening at http://0.0.0.0:%s', port);
});
