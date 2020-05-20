const { p, div, i, label, text, button, a, span } = require("./tags");
const { contract, is } = require("contractis");

module.exports = s => div("hello from builder: ", s);
