const Router = require("express-promise-router");
const db = require("saltcorn-data/db");
const { isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");

const router = new Router();
module.exports = router;

router.get("/", isAdmin, async (req, res) => {
    const rows = await db.select("plugins");
    res.sendWrap(
      "Plugins",
      mkTable(
        [
          { label: "Name", key: "name" },
          { label: "Source", key: "source" },
          { label: "Location", key: "location" },
          { label: "View", key: r => link(`/plugins/${r.id}`, "Edit") },
          {
            label: "Delete",
            key: r => post_btn(`/plugins/delete/${r.id}`, "Delete")
          }
        ],
        rows
      ),
      link(`/plugins/new`, "Add plugin")
    );
  });