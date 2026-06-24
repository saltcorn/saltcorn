const { join } = require("path");

const typesDir = join(require.resolve("@saltcorn/types/index"), "../..");

module.exports = {
  optimization: {
    minimize: false, // debug
  },
  entry: {
    markup: {
      import: join(__dirname, "./dist/index.js"),
    },
  },
  output: {
    path: __dirname,
    filename: "bundle/[name].bundle.js",
    libraryTarget: "umd",
    library: ["saltcorn", "[name]"],
  },
  resolve: {
    alias: {
      "@saltcorn/types": join(typesDir, "dist"),
    },
  },
};
