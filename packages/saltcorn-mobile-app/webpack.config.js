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
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: {
                    esmodules: true,
                    browsers: ["last 2 Chrome versions", "not dead"],
                  },
                  exclude: ["@babel/plugin-transform-async-to-generator"],
                },
              ],
            ],
          },
        },
      },
    ],
  },
  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      vm: require.resolve("vm-browserify"),
      stream: require.resolve("stream-browserify"),

    }
  },
  target: "web", // Use web target for browser compatibility
  mode: "development",
};
