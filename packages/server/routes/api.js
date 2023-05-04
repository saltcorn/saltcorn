/**
 * Table Data API handler
 * Allows to manipulate with saltcorn tables data.
 *
 * Attention! Currently, you cannot insert / update users table via this api
 * because users table has specific meaning in SC and
 * not all required (mandatory) fields of user available via this api.
 * For now this is platform limitation.
 * To solve this in future needs to publish sc_role table into user tables of saltcorn.
 *
 * Documentation: https://wiki.saltcorn.com/view/ShowPage?title=API
 * @category server
 * @module routes/api
 * @subcategory routes
 */
/** @type {module:express-promise-router} */
const Router = require("express-promise-router");
//const db = require("@saltcorn/data/db");
const { error_catcher } = require("./utils.js");
//const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
//const Field = require("@saltcorn/data/models/field");
const Trigger = require("@saltcorn/data/models/trigger");
//const load_plugins = require("../load_plugins");
const passport = require("passport");

const {
  stateFieldsToWhere,
  readState,
  strictParseInt,
} = require("@saltcorn/data/plugin-helper");
const Crash = require("@saltcorn/data/models/crash");

/**
 * @type {object}
 * @const
 * @namespace apiRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @param {*} fields
 * @returns {*}
 */
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
 * @param {object} req httprequest
 * @param {object} user - user based on access token
 * @param {Table} table
 * @returns {boolean}
 */
function accessAllowedRead(req, user, table, allow_ownership) {
  const role =
    req.user && req.user.id
      ? req.user.role_id
      : user && user.role_id
      ? user.role_id
      : 100;

  return (
    role <= table.min_role_read ||
    ((req.user?.id || user?.id) &&
      allow_ownership &&
      (table.ownership_field_id || table.ownership_formula))
  );
}

/**
 * Check that user has right to write table data (create, update, delete in terms of  CRUD)
 * @param {object} req httprequest
 * @param {object} user user based on access token
 * @param {Table} table
 * @returns {boolean}
 */
function accessAllowedWrite(req, user, table) {
  const role =
    req.user && req.user.id
      ? req.user.role_id
      : user && user.role_id
      ? user.role_id
      : 100;

  return (
    role <= table.min_role_write ||
    ((req.user?.id || user?.id) &&
      (table.ownership_field_id || table.ownership_formula))
  );
}
/**
 * Check that user has right to trigger call
 * @param {object} req httprequest
 * @param {object} user user based on access token
 * @param {Trigger} trigger
 * @returns {boolean}
 */
function accessAllowed(req, user, trigger) {
  const role =
    req.user && req.user.id
      ? req.user.role_id
      : user && user.role_id
      ? user.role_id
      : 100;

  return role <= trigger.min_role;
}

const getFlashes = (req) =>
  ["error", "success", "danger", "warning", "information"]
    .map((type) => {
      return { type, msg: req.flash(type) };
    })
    .filter((a) => a.msg && a.msg.length && a.msg.length > 0);

router.post(
  "/viewQuery/:viewName/:queryName",
  error_catcher(async (req, res, next) => {
    let { viewName, queryName } = req.params;
    const view = await View.findOne({ name: viewName });
    const db = require("@saltcorn/data/db");
    if (!view) {
      getState().log(3, `API viewQuery ${view.name} not found`);
      res.status(404).json({
        error: req.__("View %s not found", viewName),
        view: viewName,
        queryName: queryName,
        smr: req.smr,
        smrHeader: req.headers["x-saltcorn-client"],
        schema: db.getTenantSchema(),
        userTenant: req.user?.tenant,
      });
      return;
    }
    await passport.authenticate(
      "jwt",
      { session: false },
      async function (err, user, info) {
        const role = user && user.id ? user.role_id : 100;
        if (
          role <= view.min_role ||
          (await view.authorise_get({ req, ...view })) // TODO set query to state
        ) {
          const queries = view.queries(false, req);
          if (Object.prototype.hasOwnProperty.call(queries, queryName)) {
            const { args } = req.body;
            const resp = await queries[queryName](...args, true);
            res.json({ success: resp, alerts: getFlashes(req) });
          } else {
            getState().log(
              3,
              `API viewQuery ${view.name} ${queryName} not found`
            );
            res.status(404).json({
              error: req.__("Query %s not found", queryName),
              view: viewName,
              queryName: queryName,
              smr: req.smr,
              smrHeader: req.headers["x-saltcorn-client"],
              schema: db.getTenantSchema(),
              userTenant: req.user?.tenant,
            });
          }
        } else {
          getState().log(3, `API viewQuery ${view.name} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);
/**
 *
 */
router.get(
  "/:tableName/distinct/:fieldName",
  //passport.authenticate("api-bearer", { session: false }),
  error_catcher(async (req, res, next) => {
    let { tableName, fieldName } = req.params;
    const table = await Table.findOne(
      strictParseInt(tableName)
        ? { id: strictParseInt(tableName) }
        : { name: tableName }
    );
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }

    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user, table)) {
          const field = (table.getFields()).find(
            (f) => f.name === fieldName
          );
          if (!field) {
            res.status(404).json({ error: req.__("Not found") });
            return;
          }
          let dvs;
          if (
            field.is_fkey ||
            (field.type.name === "String" && field.attributes?.options)
          ) {
            dvs = await field.distinct_values();
          } else {
            dvs = await table.distinctValues(fieldName);
          }
          res.json({ success: dvs });
        } else {
          getState().log(
            3,
            `API distinct ${table.name}.${fieldName} not authorized`
          );
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

/**
 * Select Table rows using GET
 * @name get/:tableName/
 * @function
 * @memberof module:routes/api~apiRouter
 */
// todo add paging
router.get(
  "/:tableName/",
  //passport.authenticate("api-bearer", { session: false }),
  error_catcher(async (req, res, next) => {
    let { tableName } = req.params;
    const { fields, versioncount, approximate, ...req_query } = req.query;
    const table = await Table.findOne(
      strictParseInt(tableName)
        ? { id: strictParseInt(tableName) }
        : { name: tableName }
    );
    if (!table) {
      getState().log(3, `API get ${tableName} table not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }

    await passport.authenticate(
        ["api-bearer", "jwt"],
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user, table, true)) {
          let rows;
          if (versioncount === "on") {
            const joinOpts = {
              orderBy: "id",
              forUser: req.user || user || { role_id: 100 },
              forPublic: !(req.user || user),
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
            const tbl_fields = table.getFields();
            readState(req_query, tbl_fields, req);
            const qstate = await stateFieldsToWhere({
              fields: tbl_fields,
              approximate: !!approximate,
              state: req_query,
              table,
            });
            rows = await table.getRows(qstate, {
              forPublic: !(req.user || user),
              forUser: req.user || user,
            });
          } else {
            rows = await table.getRows(
              {},
              {
                forPublic: !(req.user || user),
                forUser: req.user || user,
              }
            );
          }
          res.json({ success: rows.map(limitFields(fields)) });
        } else {
          getState().log(3, `API get ${table.name} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

/**
 * Call Action (Trigger) using POST
 * Attention! if you have table with name "action" it can be problem in future
 * @name post/action/:actionname/
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.post(
  "/action/:actionname/",
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

    if (!trigger) {
      getState().log(3, `API action ${actionname} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowed(req, user, trigger)) {
          try {
            const action = getState().actions[trigger.action];
            const resp = await action.run({
              configuration: trigger.configuration,
              body: req.body,
              row: req.body,
              req,
            });
            res.json({ success: true, data: resp });
          } catch (e) {
            Crash.create(e, req);
            res.status(400).json({ success: false, error: e.message });
          }
        } else {
          getState().log(3, `API action ${actionname} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

/**
 * Insert into Table using POST
 * @name post/:tableName/
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.post(
  "/:tableName/",
  error_catcher(async (req, res, next) => {
    const { tableName } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      getState().log(3, `API POST ${tableName} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedWrite(req, user, table)) {
          const { _versions, ...row } = req.body;
          const fields = table.getFields();
          readState(row, fields, req);
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
            getState().log(
              2,
              `API POST ${table.name} error: ${errors.join(", ")}`
            );
            res.status(400).json({ error: errors.join(", ") });
            return;
          }
          const ins_res = await table.tryInsertRow(
            row,
            req.user || user || { role_id: 100 }
          );
          if (ins_res.error) {
            getState().log(2, `API POST ${table.name} error: ${ins_res.error}`);
            res.status(400).json(ins_res);
          } else res.json(ins_res);
        } else {
          getState().log(3, `API POST ${table.name} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

/**
 * Update Table row directed by ID using POST
 * POST api/<table>/id
 * @name post/:tableName/:id
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.post(
  "/:tableName/:id",
  error_catcher(async (req, res, next) => {
    const { tableName, id } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      getState().log(3, `API POST ${tableName} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedWrite(req, user, table)) {
          const { _versions, ...row } = req.body;
          const fields = table.getFields();
          readState(row, fields, req);
          let errors = [];
          let hasErrors = false;
          for (const k of Object.keys(row)) {
            const field = fields.find((f) => f.name === k);
            if (!field && k.includes(".")) {
              const [fnm, jkey] = k.split(".");
              const jfield = fields.find((f) => f.name === fnm);
              if (jfield?.type?.name === "JSON") {
                if (typeof row[fnm] === "undefined") {
                  const dbrow = await table.getRow({ [table.pk_name]: id });
                  row[fnm] = dbrow[fnm] || {};
                }
                row[fnm][jkey] = row[k];
                delete row[k];
              }
            } else if (!field || field.calculated) {
              delete row[k];
            } else if (field?.type && field.type.validate) {
              const vres = field.type.validate(field.attributes || {})(row[k]);
              if (vres.error) {
                hasErrors = true;
                errors.push(`${k}: ${vres.error}`);
              }
            }
          }
          if (hasErrors) {
            getState().log(
              2,
              `API POST ${table.name} error: ${errors.join(", ")}`
            );
            res.status(400).json({ error: errors.join(", ") });
            return;
          }
          const ins_res = await table.tryUpdateRow(
            row,
            id,
            user || req.user || { role_id: 100 }
          );

          if (ins_res.error) {
            getState().log(2, `API POST ${table.name} error: ${ins_res.error}`);
            res.status(400).json(ins_res);
          } else res.json(ins_res);
        } else {
          getState().log(3, `API POST ${table.name} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

/**
 * Delete Table row by ID using DELETE
 * @name delete/:tableName/:id
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.delete(
  "/:tableName/:id",
  // in case of primary key different from id - id will be string "undefined"
  error_catcher(async (req, res, next) => {
    const { tableName, id } = req.params;
    const table = await Table.findOne({ name: tableName });
    if (!table) {
      getState().log(3, `API DELETE ${tableName} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedWrite(req, user, table)) {
          try {
            if (id === "undefined") {
              const pk_name = table.pk_name;
              //const fields = await table.getFields();
              const row = req.body;
              //readState(row, fields);
              await table.deleteRows(
                { [pk_name]: row[pk_name] },
                user || req.user || { role_id: 100 }
              );
            } else
              await table.deleteRows(
                { id },
                user || req.user || { role_id: 100 }
              );
            res.json({ success: true });
          } catch (e) {
            getState().log(2, `API DELETE ${table.name} error: ${e.message}`);
            res.status(400).json({ error: e.message });
          }
        } else {
          getState().log(3, `API DELETE ${table.name} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);
