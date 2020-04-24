const listshowlist = require("./viewtemplates/listshowlist");
const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");
const edit = require("./viewtemplates/edit");
const { string, int, bool,date } = require("./types");

const types = [string, int, bool, date];
const viewtemplates = [list, edit, show, listshowlist];

module.exports = { types, viewtemplates };
