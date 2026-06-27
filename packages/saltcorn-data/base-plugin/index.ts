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
// import listshowlist = _sc_viewtemplates_listshowlist();
// import list = _sc_viewtemplates_list();
// import show = _sc_viewtemplates_show();
// import feed = _sc_viewtemplates_feed();
// import room = _sc_viewtemplates_room();
// import wfroom = _sc_viewtemplates_workflow_room();
// import edit = _sc_viewtemplates_edit();
// import filter = _sc_viewtemplates_filter();
// import fileviews = _sc_fileviews();
// import fieldviews = _sc_fieldviews();
// import actions = _sc_actions();
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const _sc_viewtemplates_listshowlist = () => (require("./viewtemplates/listshowlist.js") as any).default;
const _sc_viewtemplates_list = () => (require("./viewtemplates/list.js") as any).default;
const _sc_viewtemplates_show = () => (require("./viewtemplates/show.js") as any).default;
const _sc_viewtemplates_feed = () => (require("./viewtemplates/feed.js") as any).default;
const _sc_viewtemplates_room = () => (require("./viewtemplates/room.js") as any).default;
const _sc_viewtemplates_workflow_room = () => (require("./viewtemplates/workflow-room.js") as any).default;
const _sc_viewtemplates_edit = () => (require("./viewtemplates/edit.js") as any).default;
const _sc_viewtemplates_filter = () => (require("./viewtemplates/filter.js") as any).default;
const _sc_fileviews = () => (require("./fileviews.js") as any).default;
const _sc_fieldviews = () => (require("./fieldviews.js") as any).default;
const _sc_actions = () => (require("./actions.js") as any).default;
import listshowlist from "./viewtemplates/listshowlist.js";
import list from "./viewtemplates/list.js";
import show from "./viewtemplates/show.js";
import feed from "./viewtemplates/feed.js";
import room from "./viewtemplates/room.js";
import wfroom from "./viewtemplates/workflow-room.js";
import edit from "./viewtemplates/edit.js";
import filter from "./viewtemplates/filter.js";
import fileviews from "./fileviews.js";
import fieldviews from "./fieldviews.js";
import actions from "./actions.js";
import types from "./types.js";
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

export default {
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
