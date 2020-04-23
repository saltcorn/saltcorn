const { contract, is } = require("contractis");
const { is_plugin_wrap_arg, is_plugin }=require("./contracts")

const auto_test_wrap = wrap=>{
    const arg = is_plugin_wrap_arg.generate()
    return wrap(arg)
}

const auto_test_plugin = plugin => {
    is_plugin(plugin);
    if(plugin.layout) {
        auto_test_wrap(plugin.layout.wrap)
    }
};

module.exports = { auto_test_plugin };
