const path = require('path');
const webpack = require('webpack');

const NODE_ENV = process.env.NODE_ENV || 'development';
const defines = new webpack.DefinePlugin({
	'process.env': {
		'NODE_ENV': JSON.stringify(NODE_ENV),
	},
});

const config = {
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
		defines,
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

if (NODE_ENV === 'development') {
	config.devtool = 'source-map';
}

if (NODE_ENV === 'production') {
	config.entry = ['./src/index'];
	config.output = {
		path: path.join(__dirname, 'dist'),
		filename: 'fetchstream.js',
	};
	config.plugins = [
		new webpack.optimize.OccurenceOrderPlugin(),
		defines,
	];
}

module.exports = config;
