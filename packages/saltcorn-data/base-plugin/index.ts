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
// import listshowlist = listshowlistMod;
// import list = listMod;
// import show = showMod;
// import feed = feedMod;
// import room = roomMod;
// import wfroom = workflowRoomMod;
// import edit = editMod;
// import filter = filterMod;
// import fileviews = fileviewsMod;
// import fieldviews = nsFieldviews;
// import actions = actionsMod;
import listshowlistMod from "./viewtemplates/listshowlist.js";
import listMod from "./viewtemplates/list.js";
import showMod from "./viewtemplates/show.js";
import feedMod from "./viewtemplates/feed.js";
import roomMod from "./viewtemplates/room.js";
import workflowRoomMod from "./viewtemplates/workflow-room.js";
import editMod from "./viewtemplates/edit.js";
import filterMod from "./viewtemplates/filter.js";
import fileviewsMod from "./fileviews.js";
import actionsMod from "./actions.js";
import * as nsFieldviews from "./fieldviews.js";
import listshowlist from "./viewtemplates/listshowlist.js";
import list from "./viewtemplates/list.js";
import show from "./viewtemplates/show.js";
import feed from "./viewtemplates/feed.js";
import room from "./viewtemplates/room.js";
import wfroom from "./viewtemplates/workflow-room.js";
import edit from "./viewtemplates/edit.js";
import filter from "./viewtemplates/filter.js";
import fileviews from "./fileviews.js";
import * as fieldviews from "./fieldviews.js";
import actions from "./actions.js";
import { string, int, bool, date, float, color } from "./types.js";
import type { Plugin } from "@saltcorn/types/base_types";

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

const basePlugin = {
  /** @type {number} */
  sc_plugin_api_version: 1,
  /** @type {object[]} */
  types: [string, int, bool, date, float, color],
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

export default basePlugin as unknown as Plugin;
