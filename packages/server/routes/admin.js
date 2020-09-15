const Router = require("express-promise-router");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const File = require("@saltcorn/data/models/file");

const { post_btn } = require("@saltcorn/markup");
const { div, hr, form, input, label, i } = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const { getState, restart_tenant } = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("../load_plugins");
const { create_backup, restore } = require("@saltcorn/data/models/backup");
const fs = require("fs");
const load_plugins = require("../load_plugins");
const { restore_backup } = require("../markup/admin.js");

const router = new Router();
module.exports = router;

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(`Admin`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: "Settings" }, { text: "Admin" }],
        },
        {
          type: "card",
          title: "Admin",
          contents: div(
            div(
              "Restart server. Try reloading the page after a few seconds after pressing this button.",
              post_btn("/admin/restart", "Restart", req.csrfToken())
            ),
            hr(),

            post_btn("/admin/backup", "Backup", req.csrfToken()),
            hr(),
            restore_backup(req.csrfToken(), [
              i({ class: "fas fa-2x fa-upload" }),
              "<br/>",
              "Restore",
            ])
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
    if (db.getTenantSchema() === "public") {
      process.exit(0);
    } else {
      await restart_tenant(loadAllPlugins);
      req.flash("success", "Restart complete");
      res.redirect("/admin");
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
    else req.flash("success", "Successfully restored backup");
    fs.unlink(newPath, function () {});
    res.redirect(`/admin`);
  })
);
