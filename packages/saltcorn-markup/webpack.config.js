const path = require("path");

module.exports = {
  optimization: {
    minimize: false, // debug
  },
  entry: {
    index: "./dist/index.js",
  },
  output: {
    path: path.resolve(__dirname),
    filename: "bundle/[name].bundle.js",
    libraryTarget: "window",
  },
  resolve: {
    alias: {
      "@saltcorn/types": path.resolve(__dirname, "../saltcorn-types/dist"),
    },
  },
};
