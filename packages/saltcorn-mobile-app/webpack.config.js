const path = require("path");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "www/dist"),
    filename: "bundle.js",
    library: {
      type: "module",
    },
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  target: "web", // Use web target for browser compatibility
  mode: "development",
};
