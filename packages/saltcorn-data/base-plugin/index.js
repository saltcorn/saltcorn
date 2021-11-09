/** 
  * @category saltcorn-data
  * @module base-plugin/index
  * @subcategory base-plugin
  */

const listshowlist = require("./viewtemplates/listshowlist");
const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");
const feed = require("./viewtemplates/feed");
const room = require("./viewtemplates/room");
const edit = require("./viewtemplates/edit");
const filter = require("./viewtemplates/filter");
const fileviews = require("./fileviews");
const fieldviews = require("./fieldviews");
const actions = require("./actions");
const { string, int, bool, date, float, color } = require("./types");

const types = [string, int, bool, date, float, color];
const viewtemplates = [list, edit, show, listshowlist, feed, filter, room];

module.exports = {
  /** @type {number} */
  sc_plugin_api_version: 1,
  /** @type {object[]} */
  types,
  /** @type {object[]} */
  viewtemplates,
  /** @type {base-plugin/fileviews} */
  fileviews,
  /** @type {base-plugin/actions} */
  actions,
  /** @type {base-plugin/fieldviews} */
  fieldviews,
  /** @type {object} */
  serve_dependencies: {
    blockly: require.resolve("blockly/package.json"),
  },
};
