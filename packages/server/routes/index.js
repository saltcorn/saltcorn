const table = require("./tables");
const field = require("./fields");
const list = require("./list");
const view = require("./view");
const page = require("./page");
const pageedit = require("./pageedit");
const files = require("./files");
const admin = require("./admin");
const tenant = require("./tenant");
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

module.exports = app => {
  app.use("/table", table);
  app.use("/field", field);
  app.use("/files", files);
  app.use("/list", list);
  app.use("/edit", edit);
  app.use("/config", config);
  app.use("/plugins", plugins);
  app.use("/packs", packs);
  app.use("/view", view);
  app.use("/crashlog", crashlog);
  app.use("/page", page);
  app.use("/pageedit", pageedit);
  app.use("/admin", admin);
  app.use("/tenant", tenant);
  app.use("/api", api);
  app.use("/viewedit", viewedit);
  app.use("/delete", del);
  app.use("/auth", auth);
  app.use("/useradmin", useradmin);
};
