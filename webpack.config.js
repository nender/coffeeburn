const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/burn.ts',
  devtool: 'inline-source-map',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  plugins: [
    new webpack.DefinePlugin({
      DEBUG: true
    })
  ],
  output: {
    filename: 'burn.js',
    path: path.resolve(__dirname, 'dist')
  }
};