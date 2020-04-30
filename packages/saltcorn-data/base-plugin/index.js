const listshowlist = require("./viewtemplates/listshowlist");
const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");
const feed = require("./viewtemplates/feed");
const edit = require("./viewtemplates/edit");
const { string, int, bool, date, float } = require("./types");

const types = [string, int, bool, date, float];
const viewtemplates = [list, edit, show, listshowlist, feed];

module.exports = { types, viewtemplates };
