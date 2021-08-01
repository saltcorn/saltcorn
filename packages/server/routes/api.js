/**
 * Table Data API handler
 * Allows to manipulate with saltcorn tables data.
 *
 * Attention! Currently you cannot insert / update users table via this api
 * because users table has specific meaning in SC and
 * not all required (mandatory) fields of user available via this api.
 * For now this is platform limitation.
 * To solve this in future needs to publish sc_role table into user tables of saltcorn.
 *
 * Documentation: https://wiki.saltcorn.com/view/ShowPage?title=API
 * @type {module:express-promise-router}
 */
const Router = require("express-promise-router");
//const db = require("@saltcorn/data/db");
const { setTenant, error_catcher } = require("./utils.js");
//const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");
//const Field = require("@saltcorn/data/models/field");
const Trigger = require("@saltcorn/data/models/trigger");
//const load_plugins = require("../load_plugins");
const passport = require("passport");

const {
  stateFieldsToWhere,
  readState,
} = require("@saltcorn/data/plugin-helper");
const router = new Router();
module.exports = router;

const limitFields = (fields) => (r) => {
  if (fields) {
    let res = {};

    fields.split(",").forEach((f) => {
      res[f] = r[f];
    });
    return res;
  } else {
    return r;
  }
};

/**
 * Check that user has right to read table data (only read in terms of CRUD)
 * @param req - httprequest
 * @param user - user based on access token
 * @param table
 * @returns {boolean}
 */
function accessAllowedRead(req, user, table){
    const role = req.isAuthenticated()
        ? req.user.role_id
        : user && user.role_id
            ? user.role_id
            : 10;

    return role <= table.min_role_read;
}

/**
 * Check that user has right to write table data (create, update, delete in terms of  CRUD)
 * @param req - httprequest
 * @param user - user based on access token
 * @param table
 * @returns {boolean}
 */
function accessAllowedWrite(req, user, table){
    const role = req.isAuthenticated()
        ? req.user.role_id
        : user && user.role_id
            ? user.role_id
            : 10;

    return role <= table.min_role_write;

}
/**
 * Select Table rows using GET
 */
// todo add paging
router.get(
  "/:tableName/",
  setTenant,
  //passport.authenticate("api-bearer", { session: false }),
  error_catcher(async (req, res, next) => {
    const { tableName } = req.params;
    const { fields, versioncount, ...req_query } = req.query;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }

    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user, table)) {
          let rows;
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
      }
    )(req, res, next);
  })
);
/**
 * Call Action (Trigger) using POST
 * Note! You cannot call to table Action (if you will have table with sush name)
 */
router.post(
  "/action/:actionname/",
  setTenant,
  error_catcher(async (req, res, next) => {
    const { actionname } = req.params;
    // todo protect action by authorization check
    // todo we need protection from hackers
    // todo add to trigger role that can call it
    // todo include role public - anyone can call it

    const trigger = await Trigger.findOne({
      name: actionname,
      when_trigger: "API call",
    });
    if (!trigger) res.status(400).json({ error: req.__("Not found") });
    try {
      const action = getState().actions[trigger.action];
      const resp = await action.run({
        configuration: trigger.configuration,
        body: req.body,
        req,
      });
      res.json({ success: true, data: resp });
    } catch (e) {
      res.status(400).json({ success: false, error: e.message });
    }
  })
);
/**
 * Insert into Table using POST
 */
router.post(
  "/:tableName/",
  setTenant,
  error_catcher(async (req, res, next) => {
    const { tableName } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedWrite(req, user, table)) {
          const { _versions, ...row } = req.body;
          const fields = await table.getFields();
          readState(row, fields);
          let errors = [];
          let hasErrors = false;
          Object.keys(row).forEach((k) => {
            const field = fields.find((f) => f.name === k);
            if (!field || field.calculated || row[k] === undefined) {
              delete row[k];
              return;
            }
            if (field.type && field.type.validate) {
              const vres = field.type.validate(field.attributes || {})(row[k]);
              if (vres.error) {
                hasErrors = true;
                errors.push(`${k}: ${vres.error}`);
              }
            }
          });
          fields.forEach((field) => {
            if (
              field.required &&
              !field.primary_key &&
              typeof row[field.name] === "undefined"
            ) {
              hasErrors = true;
              errors.push(`${field.name}: required`);
            }
          });
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
      }
    )(req, res, next);
  })
);
/**
 * Update Table row directed by ID using POST
 * POST api/<table>/id
 */
router.post(
  "/:tableName/:id",
  setTenant,
  error_catcher(async (req, res, next) => {
    const { tableName, id } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedWrite(req, user, table)) {
          const { _versions, ...row } = req.body;
          const fields = await table.getFields();
          readState(row, fields);
          let errors = [];
          let hasErrors = false;
          Object.keys(row).forEach((k) => {
            const field = fields.find((f) => f.name === k);
            if (!field || field.calculated) {
              delete row[k];
              return;
            }
            if (field.type && field.type.validate) {
              const vres = field.type.validate(field.attributes || {})(row[k]);
              if (vres.error) {
                hasErrors = true;
                errors.push(`${k}: ${vres.error}`);
              }
            }
          });
          if (hasErrors) {
            res.status(400).json({ error: errors.join(", ") });
            return;
          }
          const ins_res = await table.tryUpdateRow(
            row,
            id,
            req.user ? +req.user.id : undefined
          );

          if (ins_res.error) res.status(400).json(ins_res);
          else res.json(ins_res);
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);
/**
 * Delete Table row by ID using DELETE
 */
router.delete(
  "/:tableName/:id",
  // in case of primary key different from id - id will be string "undefined"
  setTenant,
  error_catcher(async (req, res, next) => {
    const { tableName, id } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedWrite(req, user, table)) {

          try {
            if(id === "undefined"){
                const pk_name = table.pk_name;
                //const fields = await table.getFields();
                const row = req.body;
                //readState(row, fields);
                await table.deleteRows({  [pk_name]:  row[pk_name]} );
            }
            else
                await table.deleteRows({ id });
            res.json({ success: true });
          } catch (e) {
            res.status(400).json({ error: e.message });
          }
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);
