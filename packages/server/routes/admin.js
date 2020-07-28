const Router = require("express-promise-router");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const { post_btn } = require("@saltcorn/markup");
const { div, hr } = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const { getState, restart_tenant } = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("../load_plugins");
const { create_backup } = require("@saltcorn/data/models/backup");
const fs = require("fs");

const router = new Router();
module.exports = router;

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(
      `Admin`,
      div(
        div(
          "Restart server. Try reloading the page after a few seconds after pressing this button.",
          post_btn("/admin/restart", "Restart", req.csrfToken())
        ),
        hr(),

        post_btn("/admin/backup", "Backup", req.csrfToken())
      )
    );
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
    file.on("end", function() {
      fs.unlink(fileName, function() {});
    });
    file.pipe(res);
  })
);
