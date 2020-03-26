const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");
const { string, int, bool } = require("./types");

const types = [string, int, bool];
const viewtemplates = [list, show];

module.exports = { types, viewtemplates };
