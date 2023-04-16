const { join } = require("path");

const mocksDir = join(__dirname, "dist", "mobile-mocks");
const webpack = require("webpack");

const nodeMocks = {
  "latest-version": join(mocksDir, "node", "latest-version"),
  fs: join(mocksDir, "node", "fs"),
  "fs-extra": join(mocksDir, "node", "fs-extra"),
  "fs/promises": join(mocksDir, "node", "fs", "promises"),
  v8: join(mocksDir, "node", "v8"),
  async_hooks: join(mocksDir, "node", "async_hooks"),
  child_process: join(mocksDir, "node", "child_process"),
  "../package.json": join(__dirname, "package.json"),
};

const npmMocks = {
  "env-paths": join(mocksDir, "npm", "env-paths"),
  "fs-extended-attributes": join(mocksDir, "npm", "fs-extended-attributes"),
  tar: join(mocksDir, "npm", "tar"),
};

const saltcornMocks = {
  "./pack": join(mocksDir, "models", "pack"),
  "../models/pack": join(mocksDir, "models", "pack"),
  "./email": join(mocksDir, "models", "email"),
  "../models/email": join(mocksDir, "models", "email"),
  "../plugin-testing": join(mocksDir, "saltcorn", "plugin-testing"),
  "../../plugin-testing": join(mocksDir, "saltcorn", "plugin-testing"),
  "@saltcorn/html-pdf-node": join(mocksDir, "saltcorn", "html-pdf-node"),
  "./html-pdf-node": join(mocksDir, "saltcorn", "html-pdf-node"),
};

const dbMocks = {
  "@saltcorn/sqlite/sqlite": join(mocksDir, "db", "sqlite"),
  "@saltcorn/postgres/postgres": join(mocksDir, "db", "postgres"),
};

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
    data: {
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
    fallback: {
      console: require.resolve("console-browserify"),
      assert: require.resolve("assert/"),
      path: require.resolve("path-browserify"),
      crypto: require.resolve("crypto-browserify"),
      buffer: require.resolve("buffer/"),
      stream: require.resolve("stream-browserify"),
      url: require.resolve("url"),
      http: require.resolve("stream-http"),
      https: require.resolve("https-browserify"),
      util: require.resolve("util"),
      os: require.resolve("os-browserify/browser"),
      vm: require.resolve("vm-browserify"),
      zlib: require.resolve("browserify-zlib"),
      constants: require.resolve("constants-browserify"),
    },
    alias: {
      process: "process/browser",
      ...nodeMocks,
      ...npmMocks,
      ...saltcornMocks,
      ...dbMocks,
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ],
};
