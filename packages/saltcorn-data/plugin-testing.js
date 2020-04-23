const { contract, is, auto_test } = require("contractis");
const { is_plugin_wrap, is_plugin } = require("./contracts");

const auto_test_wrap = wrap => {
  auto_test(contract(is_plugin_wrap, wrap, { n: 5 }));
};
const auto_test_type = t => {
  const fvs = t.fieldviews || {};

  //run edit field views without a value
  Object.values(fvs).forEach(fv => {
    if (fv.isEdit) {
      is.str(fv.run("foo", undefined, {}, "myclass", true));
      is.str(fv.run("foo", undefined, {}, "myclass", false));
    }
  });
  //find examples

  //run all fieldview on each example

  //try creating a table with this type
};
const auto_test_plugin = plugin => {
  is_plugin(plugin);
  if (plugin.layout) {
    auto_test_wrap(plugin.layout.wrap);
  }
  if (plugin.types) {
    plugin.types.forEach(auto_test_type);
  }
};

module.exports = { auto_test_plugin };
