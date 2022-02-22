const { join } = require("path");

const mocksDir = join(__dirname, "dist", "mobile-mocks");

const nodeMocks = {
  "latest-version": join(mocksDir, "node", "latest-version"),
  fs: join(mocksDir, "node", "fs"),
  "fs/promises": join(mocksDir, "node", "fs", "promises"),
  v8: join(mocksDir, "node", "v8"),
  async_hooks: join(mocksDir, "node", "async_hooks"),
  child_process: join(mocksDir, "node", "child_process"),
};

const npmMocks = {
  "env-paths": join(mocksDir, "npm", "env-paths"),
};

const saltcornMocks = {
  "./email": join(mocksDir, "models", "email"),

  // this will be removed
  "./state": join(mocksDir, "saltcorn", "state"),
  "../state": join(mocksDir, "saltcorn", "state"),
  "./db/state": join(mocksDir, "saltcorn", "state"),
  "../db/state": join(mocksDir, "saltcorn", "state"),
  "../../db/state": join(mocksDir, "saltcorn", "state"),
  "../plugin-helper": join(mocksDir, "saltcorn", "plugin-helper"),
  "../../plugin-helper": join(mocksDir, "saltcorn", "plugin-helper"),
  "../plugin-testing": join(mocksDir, "saltcorn", "plugin-testing"),
  "../../plugin-testing": join(mocksDir, "saltcorn", "plugin-testing"),
  "./viewable_fields": join(mocksDir, "saltcorn", "viewable_fields"),
  "../base-plugin/viewtemplates/viewable_fields": join(
    mocksDir,
    "saltcorn",
    "viewable_fields"
  ),
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
    },
    alias: {
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
};
