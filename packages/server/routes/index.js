/**
 * Index is Main Router of App
 */

import table from "./tables.js";
import field from "./fields.js";
import list from "./list.js";
import view from "./view.js";
import page from "./page.js";
import pagegroup from "./page_group.js";
import pagegroupedit from "./page_groupedit.js";
import pageedit from "./pageedit.js";
import search from "./search.js";
import files from "./files.js";
import menu from "./menu.js";
import admin from "./admin.js";
import actions from "./actions.js";
import eventlog from "./eventlog.js";
import infoarch from "./infoarch.js";
import events from "./events.js";
import tenant from "./tenant.js";
import models from "./models.js";
import library from "./library.js";
import settings from "./settings.js";
import plugins from "./plugins.js";
import packs from "./packs.js";
import edit from "./edit.js";
import config from "./config.js";
import viewedit from "./viewedit.js";
import crashlog from "./crashlog.js";
import notifications from "./notifications.js";
import del from "./delete.js";
import auth from "../auth/routes.js";
import useradmin from "../auth/admin.js";
import roleadmin from "../auth/roleadmin.js";
import tags from "./tags.js";
import tagentries from "./tag_entries.js";
import diagram from "./diagram.js";
import registry from "./registry.js";
import sync from "./sync.js";
import entities from "./entities.js";

export default /**
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
  app.use("/models", models);
  app.use("/settings", settings);
  app.use("/pageedit", pageedit);
  app.use("/page_group", pagegroup);
  app.use("/page_groupedit", pagegroupedit);
  app.use("/actions", actions);
  app.use("/eventlog", eventlog);
  app.use("/library", library);
  app.use("/notifications", notifications);
  app.use("/site-structure", infoarch);
  app.use("/search", search);
  app.use("/admin", admin);
  app.use("/tenant", tenant);
  app.use("/viewedit", viewedit);
  app.use("/delete", del);
  app.use("/auth", auth);
  app.use("/useradmin", useradmin);
  app.use("/roleadmin", roleadmin);
  app.use("/tag", tags);
  app.use("/tag-entries", tagentries);
  app.use("/diagram", diagram);
  app.use("/registry-editor", registry);
  app.use("/sync", sync);
  app.use("/entities", entities);
};
