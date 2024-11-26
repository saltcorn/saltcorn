const path = require("path");
const webpack = require('webpack')
module.exports = {
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  output: {
    filename: "builder_bundle.js",
    library: "builder",
    //libraryTarget: 'window',
    //libraryExport: 'default'
  },
  plugins: [
    // fix "process is not defined" error:
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ]
};
