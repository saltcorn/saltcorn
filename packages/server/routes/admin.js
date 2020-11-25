const Router = require("express-promise-router");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const File = require("@saltcorn/data/models/file");
const { spawn } = require("child_process");

const { post_btn } = require("@saltcorn/markup");
const {
  div,
  hr,
  form,
  input,
  label,
  i,
  h4,
  table,
  tbody,
  td,
  th,
  tr,
  button,
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const { getState, restart_tenant } = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("../load_plugins");
const { create_backup, restore } = require("@saltcorn/data/models/backup");
const fs = require("fs");
const load_plugins = require("../load_plugins");
const { restore_backup } = require("../markup/admin.js");
var packagejson = require("../package.json");
const router = new Router();
module.exports = router;

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    res.sendWrap(req.__(`Admin`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Settings") }, { text: req.__("Admin") }],
        },
        {
          type: "card",
          title: req.__("Admin"),
          contents: div(
            div(
              req.__("Restart server."),
              post_btn("/admin/restart", req.__("Restart"), req.csrfToken(), {
                ajax: true,
                reload_delay: 4000,
                spinner: true,
              })
            ),
            hr(),

            post_btn("/admin/backup", req.__("Backup"), req.csrfToken()),
            hr(),
            restore_backup(req.csrfToken(), [
              i({ class: "fas fa-2x fa-upload" }),
              "<br/>",
              req.__("Restore"),
            ]),
            hr(),
            h4(req.__("About Saltcorn")),
            table(
              tbody(
                tr(
                  th(req.__("Saltcorn version")),
                  td(
                    packagejson.version +
                      (isRoot
                        ? post_btn(
                            "/admin/upgrade",
                            req.__("Upgrade"),
                            req.csrfToken(),
                            {
                              btnClass: "btn-primary btn-sm",
                              formClass: "d-inline",
                            }
                          )
                        : "")
                  )
                ),
                tr(th(req.__("Node.js version")), td(process.version)),
                tr(
                  th(req.__("Database")),
                  td(db.isSQLite ? "SQLite" : "PostgreSQL")
                )
              )
            )
          ),
        },
      ],
    });
  })
);

router.post(
  "/restart",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    if (db.getTenantSchema() === db.connectObj.default_schema) {
      process.exit(0);
    } else {
      await restart_tenant(loadAllPlugins);
      req.flash("success", req.__("Restart complete"));
      res.redirect("/admin");
    }
  })
);

router.post(
  "/upgrade",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    if (db.getTenantSchema() !== db.connectObj.default_schema) {
      req.flash("error", req.__("Not possible for tenant"));
      res.redirect("/admin");
    } else {
      res.write("Starting upgrade\n");
      const child = spawn(
        "npm",
        ["install", "-g", "@saltcorn/cli@latest", "--unsafe"],
        {
          stdio: ["ignore", "pipe", process.stderr],
        }
      );
      child.stdout.on("data", (data) => {
        res.write(data);
      });
      child.on("exit", function (code, signal) {
        res.end(
          `Upgrade done (if it was available) with code ${code}.\n\nPress the BACK button in your browser, then RELOAD the page.`
        );
        setTimeout(() => {
          process.exit(0);
        }, 100);
      });
    }
  })
);

router.post(
  "/backup",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const fileName = await create_backup();
    res.type("application/zip");
    res.attachment(fileName);
    var file = fs.createReadStream(fileName);
    file.on("end", function () {
      fs.unlink(fileName, function () {});
    });
    file.pipe(res);
  })
);

router.post(
  "/restore",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const newPath = File.get_new_path();
    await req.files.file.mv(newPath);
    const err = await restore(newPath, (p) =>
      load_plugins.loadAndSaveNewPlugin(p)
    );
    if (err) req.flash("error", err);
    else req.flash("success", req.__("Successfully restored backup"));
    fs.unlink(newPath, function () {});
    res.redirect(`/admin`);
  })
);
