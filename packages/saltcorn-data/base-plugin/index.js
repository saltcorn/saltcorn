const listshowlist = require("./viewtemplates/listshowlist");
const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");
const feed = require("./viewtemplates/feed");
const edit = require("./viewtemplates/edit");
const filter = require("./viewtemplates/filter");
const fileviews = require("./fileviews");
const { string, int, bool, date, float, color } = require("./types");

const types = [string, int, bool, date, float, color];
const viewtemplates = [list, edit, show, listshowlist, feed, filter];

module.exports = { sc_plugin_api_version: 1, types, viewtemplates, fileviews };
