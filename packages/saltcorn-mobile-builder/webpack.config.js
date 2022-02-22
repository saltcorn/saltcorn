const { mergeWithCustomize, merge } = require("webpack-merge");
const { join } = require("path");

const dataCfg = require(join(
  require.resolve("@saltcorn/data"),
  "../..",
  "webpack.config"
));
const markupCfg = require(join(
  require.resolve("@saltcorn/markup"),
  "../..",
  "webpack.config"
));

const addDependOn = (dataEntryPoint, b) => {
  const copy = { ...dataEntryPoint };
  copy.data.dependOn = "markup";
  return merge({}, copy, b);
};

const out = mergeWithCustomize({
  customizeArray(a, b, key) {
    if (key === "library") {
      return _.uniq([...a, ...b]);
    }
    return undefined;
  },
  customizeObject(a, b, key) {
    if (key === "output") {
      const copy = { ...a };
      copy.path = __dirname;
      return copy;
    }
    if (key === "entry") {
      if (a.data) return addDependOn(a, b);
      else if (b.data) return addDependOn(b, a);
    }
    return undefined;
  },
})(dataCfg, markupCfg);

module.exports = out;
