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
// import listshowlist = require("./viewtemplates/listshowlist");
// import list = require("./viewtemplates/list");
// import show = require("./viewtemplates/show");
// import feed = require("./viewtemplates/feed");
// import room = require("./viewtemplates/room");
// import wfroom = require("./viewtemplates/workflow-room");
// import edit = require("./viewtemplates/edit");
// import filter = require("./viewtemplates/filter");
// import fileviews = require("./fileviews");
// import fieldviews = require("./fieldviews");
// import actions = require("./actions");
import listshowlist from "./viewtemplates/listshowlist";
import list from "./viewtemplates/list";
import show from "./viewtemplates/show";
import feed from "./viewtemplates/feed";
import room from "./viewtemplates/room";
import wfroom from "./viewtemplates/workflow-room";
import edit from "./viewtemplates/edit";
import filter from "./viewtemplates/filter";
import fileviews from "./fileviews";
import fieldviews from "./fieldviews";
import actions from "./actions";
import types from "./types";
const { string, int, bool, date, float, color } = types;

const viewtemplates = [
  list,
  edit,
  show,
  listshowlist,
  feed,
  filter,
  room,
  wfroom,
];

export = {
  /** @type {number} */
  sc_plugin_api_version: 1,
  /** @type {object[]} */
  types: [ string, int, bool, date, float, color ],
  /** @type {object[]} */
  viewtemplates,
  /** @type {base-plugin/fileviews} */
  fileviews,
  /** @type {base-plugin/actions} */
  actions,
  /** @type {base-plugin/fieldviews} */
  fieldviews,
  /** @type {object} */
};
