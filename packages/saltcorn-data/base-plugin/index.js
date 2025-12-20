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
const db = require("../db");
const listshowlist = require("./viewtemplates/listshowlist");
const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");
const feed = require("./viewtemplates/feed");
const room = require("./viewtemplates/room");
const wfroom = require("./viewtemplates/workflow-room");
const edit = require("./viewtemplates/edit");
const filter = require("./viewtemplates/filter");
const fileviews = require("./fileviews");
const fieldviews = require("./fieldviews");
const actions = require("./actions");
const { string, int, bool, date, float, color } = require("./types");
const multifileupload = require("./viewtemplates/multi_file_upload");
// const pkg = require("../package.json");

// console.log({
//   version: pkg.version,
// });

const vers = (db.connectObj && db.connectObj.version_tag) || "dev";
const types = [string, int, bool, date, float, color];
const viewtemplates = [
  list,
  edit,
  show,
  listshowlist,
  feed,
  filter,
  room,
  wfroom,
  multifileupload,
];

const pluginHeaders = [
  {
    script: `/static_assets/${vers}/multi-file-upload.js`,
    onlyViews: [multifileupload.name],
  },
  {
    style: `
.sc-mfu { border: 1px solid var(--bs-border-color, #dee2e6); border-radius: 0.5rem; padding: 1rem; }
.sc-mfu-list { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
.sc-mfu-row { background: rgba(0,0,0,0.02); border-radius: 0.35rem; padding: 0.5rem 0.75rem; }
.sc-mfu-dropzone { border: 2px dashed var(--bs-border-color, #ced4da); border-radius: 0.5rem; padding: 1rem; text-align: center; cursor: pointer; color: var(--bs-secondary-color, #6c757d); transition: background 0.15s ease, border-color 0.15s ease; }
.sc-mfu-dropzone:hover { background: rgba(0,0,0,0.03); border-color: var(--bs-primary, #0d6efd); color: var(--bs-primary, #0d6efd); }
.sc-mfu-dropzone--active { border-color: var(--bs-primary, #0d6efd); color: var(--bs-primary, #0d6efd); background: rgba(13,110,253,0.08); }
.sc-mfu.sc-mfu-disabled, .sc-mfu.sc-mfu-uploading { opacity: 0.6; pointer-events: none; }
    `,
    onlyViews: [multifileupload.name],
  },
];

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
  headers: pluginHeaders,
  /** @type {object} */
};
