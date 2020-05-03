const Router = require("express-promise-router");
const db = require("saltcorn-data/db");
const { isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const State = require("saltcorn-data/db/state");
const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const load_plugins = require("../load_plugins");

const router = new Router();
module.exports = router;

const noId = r => {
  const { id, ...rest } = r;
  return rest;
};

router.get("/:tableName/", async (req, res) => {
  const { tableName } = req.params;
  const table = await Table.findOne({ name: tableName });
  const role = req.isAuthenticated() ? req.user.role_id : 4;
  if (table.expose_api_read && role <= table.min_role_read) {
    const rows = await table.getRows();
    res.json({ success: rows.map(noId) });
  } else {
    res.status(401).json({ error: "Not authorized" });
  }
});
