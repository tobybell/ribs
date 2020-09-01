const path = require("path");

module.exports = {
  entry: "./src/index.ts",
  devServer: {
    contentBase: './dist',
    hot: true,
  },
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
  },
};
