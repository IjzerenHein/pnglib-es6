/*global module*/
module.exports = {
	entry: './demo/src.js',
	output: {
		path: './demo/',
		filename: 'demo.js'
	},
	devServer: {
		inline: true,
		port: 8080
	},
	module: {
		loaders: [{
			test: /\.js$/,
			exclude: /node_modules/,
			loader: 'babel'
		}]
	}
};
