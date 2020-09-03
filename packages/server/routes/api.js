const Router = require("express-promise-router");
const db = require("@saltcorn/data/db");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const load_plugins = require("../load_plugins");
const { stateFieldsToWhere } = require("@saltcorn/data/plugin-helper");
const router = new Router();
module.exports = router;

const limitFields = (fields) => (r) => {
  if (fields) {
    var res = {};

    fields.split(",").forEach((f) => {
      res[f] = r[f];
    });
    return res;
  } else {
    const { id, ...rest } = r;
    return rest;
  }
};

router.get(
  "/:tableName/",
  setTenant,
  error_catcher(async (req, res) => {
    const { tableName } = req.params;
    const { fields, ...req_query } = req.query;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    if (table.expose_api_read && role <= table.min_role_read) {
      var rows;
      if (req_query && req_query !== {}) {
        const tbl_fields = await table.getFields();
        const qstate = await stateFieldsToWhere({
          fields: tbl_fields,
          approximate: false,
          state: req.query,
        });
        rows = await table.getRows(qstate);
      } else {
        rows = await table.getRows();
      }
      res.json({ success: rows.map(limitFields(fields)) });
    } else {
      res.status(401).json({ error: "Not authorized" });
    }
  })
);
