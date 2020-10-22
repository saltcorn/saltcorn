const Router = require("express-promise-router");
const db = require("@saltcorn/data/db");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const load_plugins = require("../load_plugins");
const {
  stateFieldsToWhere,
  readState,
} = require("@saltcorn/data/plugin-helper");
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
    return r;
  }
};

router.get(
  "/:tableName/",
  setTenant,
  error_catcher(async (req, res) => {
    const { tableName } = req.params;
    const { fields, versioncount, ...req_query } = req.query;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    if (role <= table.min_role_read) {
      var rows;
      if (versioncount === "on") {
        const joinOpts = {
          orderBy: "id",
          aggregations: {
            _versions: {
              table: table.name + "__history",
              ref: "id",
              field: "id",
              aggregate: "count",
            },
          },
        };
        rows = await table.getJoinedRows(joinOpts);
      } else if (req_query && req_query !== {}) {
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
      res.status(401).json({ error: req.__("Not authorized") });
    }
  })
);

router.post(
  "/:tableName/",
  setTenant,
  error_catcher(async (req, res) => {
    const { tableName } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    if (role <= table.min_role_write) {
      const { _versions, ...row } = req.body;
      const fields = await table.getFields();
      readState(row, fields);
      let errors = [];
      let hasErrors = false;
      Object.keys(row).forEach((k) => {
        const field = fields.find((f) => f.name === k);
        if (!field || field.calculated) {
          delete row[k];
        }
        if (field.required && typeof row[k] === "undefined") {
          hasErrors = true;
          errors.push(`${k}: required`);
        }

        if (field.type && field.type.validate) {
          const vres = field.type.validate(field.attributes || {})(row[k]);
          if (vres.error) {
            hasErrors = true;
            errors.push(`${k}: ${vres.error}`);
          }
        }
      });
      console.log({ hasErrors, errors });
      if (hasErrors) {
        res.status(400).json({ error: errors.join(", ") });
        return;
      }
      const ins_res = await table.tryInsertRow(
        row,
        req.user ? +req.user.id : undefined
      );
      if (ins_res.error) res.status(400).json(ins_res);
      else res.json(ins_res);
    } else {
      res.status(401).json({ error: req.__("Not authorized") });
    }
  })
);

router.post(
  "/:tableName/:id",
  setTenant,
  error_catcher(async (req, res) => {
    const { tableName, id } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    if (role <= table.min_role_write) {
      const { _versions, ...row } = req.body;
      const fields = await table.getFields();
      readState(row, fields);
      let errors = [];
      let hasErrors = false;
      Object.keys(row).forEach((k) => {
        const field = fields.find((f) => f.name === k);
        if (!field || field.calculated) {
          delete row[k];
        }
        if (field.required && typeof row[k] === "undefined") {
          hasErrors = true;
          errors.push(`${k}: required`);
        }
        if (field.type && field.type.validate) {
          const vres = field.type.validate(field.attributes || {})(row[k]);
          if (vres.error) {
            hasErrors = true;
            errors.push(`${k}: ${res.error}`);
          }
        }
      });
      if (hasErrors) {
        res.status(400).json({ error: errors.join(", ") });
        return;
      }
      const ins_res = await table.tryUpdateRow(
        row,
        +id,
        req.user ? +req.user.id : undefined
      );

      if (ins_res.error) res.status(400).json(ins_res);
      else res.json(ins_res);
    } else {
      res.status(401).json({ error: req.__("Not authorized") });
    }
  })
);
router.delete(
  "/:tableName/:id",
  setTenant,
  error_catcher(async (req, res) => {
    const { tableName, id } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    if (role <= table.min_role_write) {
      try {
        await table.deleteRows({ id });
        res.json({ success: true });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    } else {
      res.status(401).json({ error: req.__("Not authorized") });
    }
  })
);
