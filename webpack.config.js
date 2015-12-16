const path = require('path');
const webpack = require('webpack');

// TODO production config

module.exports = {
	devtool: 'source-map',
	entry: [
		'webpack-hot-middleware/client',
		'./demo/index',
	],
	output: {
		path: path.join(__dirname, 'build'),
		filename: 'bundle.js',
		publicPath: '/static/',
	},
	plugins: [
		new webpack.HotModuleReplacementPlugin(),
		new webpack.NoErrorsPlugin(),
	],
	module: {
		loaders: [
			{
				test: /\.json$/,
				loader: 'json',
			},
			{
				test: /\.jsx?$/,
				loader: 'babel',
				exclude: /node_modules/,
			},
		],
	},
	resolve: {
		extensions: ['', '.js', '.jsx'],
		modulesDirectories: ['node_modules', 'demo', 'src'],
	},
};
