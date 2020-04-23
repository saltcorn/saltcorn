const { contract, is } = require("contractis");
const {  is_plugin }=require("./contracts")

const auto_test_plugin = plugin => {
    is_plugin(plugin);
};

module.exports = { auto_test_plugin };
