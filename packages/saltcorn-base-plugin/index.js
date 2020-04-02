const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");
const edit = require("./viewtemplates/edit");
const { string, int, bool } = require("./types");

const types = [string, int, bool];
const viewtemplates = [list, edit, show];

module.exports = { types, viewtemplates };
