const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: './src/main.ts',
  devtool: 'inline-source-map',
  mode: 'production',
  watch: true,
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
      DEBUG: false
    })
  ],
  output: {
    filename: 'burn.js',
    path: path.resolve(__dirname, 'dist')
  }
};