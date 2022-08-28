/**
 * Index is Main Router of App
 * @category server
 * @module routes/index
 * @subcategory routes
 */

/**
 * All files in the routes module.
 * @namespace routes_overview
 * @property {module:routes/actions} actions
 * @property {module:routes/admin} admin
 * @property {module:routes/api} api
 * @property {module:routes/config} config
 * @property {module:routes/crashlog} crashlog
 * @property {module:routes/delete} delete
 * @property {module:routes/edit} edit
 * @property {module:routes/eventlog} eventlog
 * @property {module:routes/events} events
 * @property {module:routes/fields} fields
 * @property {module:routes/files} files
 * @property {module:routes/homepage} homepage
 * @property {module:routes/infoarch} infoarch
 * @property {module:routes/library} library
 * @property {module:routes/list} list
 * @property {module:routes/menu} menu
 * @property {module:routes/packs} packs
 * @property {module:routes/page} page
 * @property {module:routes/pageedit} pageedit
 * @property {module:routes/plugins} plugins
 * @property {module:routes/scapi} scapi
 * @property {module:routes/search} search
 * @property {module:routes/settings} settings
 * @property {module:routes/tables} tables
 * @property {module:routes/tenant} tenant
 * @property {module:routes/utils} utils
 * @property {module:routes/view} view
 * @property {module:routes/viewedit} viewedit
 *
 * @category server
 * @subcategory routes
 */

const table = require("./tables");
const field = require("./fields");
const list = require("./list");
const view = require("./view");
const page = require("./page");
const pageedit = require("./pageedit");
const search = require("./search");
const files = require("./files");
const menu = require("./menu");
const admin = require("./admin");
const actions = require("./actions");
const eventlog = require("./eventlog");
const infoarch = require("./infoarch");
const events = require("./events");
const tenant = require("./tenant");
const library = require("./library");
const settings = require("./settings");
const api = require("./api");
const plugins = require("./plugins");
const packs = require("./packs");
const edit = require("./edit");
const config = require("./config");
const viewedit = require("./viewedit");
const crashlog = require("./crashlog");
const del = require("./delete");
const auth = require("../auth/routes");
const useradmin = require("../auth/admin");
const roleadmin = require("../auth/roleadmin");
const scapi = require("./scapi");
const tags = require("./tags");
const tagentries = require("./tag_entries");
const dataDiagram = require("./diagram");

module.exports =
  /**
   * Function assigned to 'module.exports'
   * @returns {void}
   */
  (app) => {
    app.use("/table", table);
    app.use("/field", field);
    app.use("/files", files);
    app.use("/list", list);
    app.use("/edit", edit);
    app.use("/config", config);
    app.use("/plugins", plugins);
    app.use("/packs", packs);
    app.use("/menu", menu);
    app.use("/view", view);
    app.use("/crashlog", crashlog);
    app.use("/events", events);
    app.use("/page", page);
    app.use("/settings", settings);
    app.use("/pageedit", pageedit);
    app.use("/actions", actions);
    app.use("/eventlog", eventlog);
    app.use("/library", library);
    app.use("/site-structure", infoarch);
    app.use("/search", search);
    app.use("/admin", admin);
    app.use("/tenant", tenant);
    app.use("/api", api);
    app.use("/viewedit", viewedit);
    app.use("/delete", del);
    app.use("/auth", auth);
    app.use("/useradmin", useradmin);
    app.use("/roleadmin", roleadmin);
    app.use("/scapi", scapi);
    app.use("/tag", tags);
    app.use("/tag-entries", tagentries);
    app.use("/diagram", dataDiagram);
  };
