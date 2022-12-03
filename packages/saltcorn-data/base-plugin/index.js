/**
 * @category saltcorn-data
 * @module base-plugin/index
 * @subcategory base-plugin
 */

/**
 * All files in the base-plugin module.
 * @namespace base-plugin_overview
 * @property {module:base-plugin/actions} actions
 * @property {module:base-plugin/fieldviews} fieldviews
 * @property {module:base-plugin/fileview} fileview
 * @property {module:base-plugin/types} types
 *
 * @property {module:base-plugin/viewtemplates/edit} edit
 * @property {module:base-plugin/viewtemplates/feed} feed
 * @property {module:base-plugin/viewtemplates/filter} filter
 * @property {module:base-plugin/viewtemplates/list} list
 * @property {module:base-plugin/viewtemplates/listshowlist} listshowlist
 * @property {module:base-plugin/viewtemplates/room} room
 * @property {module:base-plugin/viewtemplates/show} show
 * @property {module:base-plugin/viewtemplates/viewable_fields} viewable_fields
 *
 *
 * @category saltcorn-data
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
