const path = require("path");

module.exports = {
  optimization: {
    minimize: false, // debug
  },
  entry: {
    markup: "./dist/index.js",
  },
  output: {
    path: path.resolve(__dirname),
    filename: "bundle/[name].bundle.js",
    libraryTarget: "umd",
    library: ["saltcorn", "[name]"],
  },
  resolve: {
    alias: {
      "@saltcorn/types": path.resolve(__dirname, "../saltcorn-types/dist"),
    },
  },
};
