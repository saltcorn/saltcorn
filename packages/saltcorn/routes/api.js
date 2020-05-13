const Router = require("express-promise-router");
const db = require("saltcorn-data/db");
const { isAdmin } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const { getState } = require("saltcorn-data/db/state");
const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const load_plugins = require("../load_plugins");
const { stateFieldsToWhere } = require("saltcorn-data/plugin-helper");
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
    var rows;
    if (req.query && req.query !== {}) {
      const fields = await table.getFields();
      const qstate = await stateFieldsToWhere({
        fields,
        approximate: false,
        state: req.query
      });
      rows = await table.getRows(qstate);
    } else {
      rows = await table.getRows();
    }
    res.json({ success: rows.map(noId) });
  } else {
    res.status(401).json({ error: "Not authorized" });
  }
});
