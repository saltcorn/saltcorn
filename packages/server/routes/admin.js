const Router = require("express-promise-router");

const { setTenant, isAdmin } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const { post_btn } = require("@saltcorn/markup");
const { div } = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");
const { getState, restart_tenant } = require("@saltcorn/data/db/state");
const { loadAllPlugins } = require("../load_plugins");

const router = new Router();
module.exports = router;

router.get("/", setTenant, isAdmin, async (req, res) => {
  res.sendWrap(
    `Admin`,
    div(
      "Restart server. Try reloading the page after a few seconds after pressing this button.",
      post_btn("/admin/restart", "Restart")
    )
  );
});

router.post("/restart", setTenant, isAdmin, async (req, res) => {
  if (db.getTenantSchema() === "public") {
    process.exit(0);
  } else {
    await restart_tenant(loadAllPlugins);
    req.flash("success", "Restart complete");
    res.redirect("/admin");
  }
});
