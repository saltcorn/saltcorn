const { contract, is, auto_test } = require("contractis");
const { is_plugin_wrap, is_plugin } = require("./contracts");

const auto_test_wrap = wrap => {
  auto_test(contract(is_plugin_wrap, wrap, { n: 5 }));
};

const auto_test_plugin = plugin => {
  is_plugin(plugin);
  if (plugin.layout) {
    auto_test_wrap(plugin.layout.wrap);
  }
};

module.exports = { auto_test_plugin };
