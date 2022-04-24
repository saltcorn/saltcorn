const { join } = require("path");

module.exports = {
  optimization: {
    minimize: false, // debug
    splitChunks: {
      chunks: "all",
      name: "common_chunks",
    },
  },
  entry: {
    sbadmin2: {
      import: join(__dirname, "./index.js"),
      dependOn: ["data", "markup"],
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
