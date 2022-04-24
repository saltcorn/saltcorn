const { join } = require("path");

module.exports = {
  optimization: {
    minimize: false, // debug
    //runtimeChunk: "single",
    splitChunks: {
      chunks: "all",
      name: "common_chunks",
    },
  },
  entry: {
    base_plugin: {
      import: join(__dirname, "./index.js"),
      dependOn: "data",
    },
  },
  output: {
    path: __dirname,
    filename: "bundle/[name].bundle.js",
    libraryTarget: "umd",
    library: ["saltcorn", "[name]"],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
      },
    ],
  },
};
