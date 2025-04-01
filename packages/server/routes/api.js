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
const db = require("@saltcorn/data/db");
const { error_catcher } = require("./utils.js");
//const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const {
  prepare_update_row,
  prepare_insert_row,
} = require("@saltcorn/data/web-mobile-commons");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
//const Field = require("@saltcorn/data/models/field");
const Trigger = require("@saltcorn/data/models/trigger");
const File = require("@saltcorn/data/models/file");
//const load_plugins = require("../load_plugins");
const passport = require("passport");
const path = require("path");

const {
  readState,
  strictParseInt,
  stateFieldsToWhere,
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
      getState().log(3, `API viewQuery ${viewName} not found`);
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
            const { args } = req.body || {};
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

router.get(
  "/serve-files/*serve_path",
  //passport.authenticate("api-bearer", { session: false }),
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        const role = req?.user?.role_id || user?.role_id || 100;
        const user_id = req?.user?.id || user?.id;
        const serve_path = path.join(...req.params.serve_path);
        const file = await File.findOne(serve_path);
        if (
          file &&
          (role <= file.min_role_read || (user_id && user_id === file.user_id))
        ) {
          res.type(file.mimetype);
          const cacheability =
            file.min_role_read === 100 ? "public" : "private";
          const maxAge = getState().getConfig("files_cache_maxage", 86400);
          res.set("Cache-Control", `${cacheability}, max-age=${maxAge}`);
          if (file.s3_store)
            res.status(404).json({ error: req.__("Not found") });
          else res.sendFile(file.location, { dotfiles: "allow" });
        } else {
          res.status(404).json({ error: req.__("Not found") });
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
    const table = Table.findOne(
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
          const field = table.getFields().find((f) => f.name === fieldName);
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

function validateNumberMin(value, min) {
  if (typeof value !== "number") {
    // return false; //throw new TypeError('Value is not a number');
    value = strictParseInt(value);
  }

  if (!Number.isSafeInteger(value)) {
    return false; //throw new RangeError('Value is outside the valid range for an integer');
  }
  if (value < min) return false;
  return true;
}

router.get(
  "/:tableName/",
  //passport.authenticate("api-bearer", { session: false }),
  error_catcher(async (req, res, next) => {
    let { tableName } = req.params;
    const {
      fields,
      versioncount,
      limit,
      offset,
      sortBy,
      sortDesc,
      approximate,
      dereference,
      tabulator_pagination_format,
      ...req_query0
    } = req.query;

    let req_query = req_query0;
    let tabulator_size, tabulator_page, tabulator_sort, tabulator_dir;
    if (tabulator_pagination_format) {
      const { page, size, sort, ...rq } = req_query0;
      req_query = rq;
      tabulator_page = page;
      tabulator_size = size;
      tabulator_sort = sort?.[0]?.field;
      tabulator_dir = sort?.[0]?.dir;
    }
    if (typeof limit !== "undefined")
      if (isNaN(limit) || !validateNumberMin(limit, 1)) {
        getState().log(3, `API get ${tableName} Invalid limit parameter`);
        return res.status(400).send({ error: "Invalid limit parameter" });
      }
    if (typeof offset !== "undefined")
      if (isNaN(offset) || !validateNumberMin(offset, 1)) {
        getState().log(3, `API get ${tableName} Invalid offset parameter`);
        return res.status(400).send({ error: "Invalid offset parameter" });
      }
    const table = Table.findOne(
      strictParseInt(tableName)
        ? { id: strictParseInt(tableName) }
        : { name: tableName }
    );
    if (!table) {
      getState().log(3, `API get ${tableName} table not found`);
      getState().log(
        6,
        `API get failure additonal info: URL=${req.originalUrl}${
          getState().getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
        }`
      );
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    const orderByField =
      (sortBy || tabulator_sort) && table.getField(sortBy || tabulator_sort);

    const use_limit = tabulator_pagination_format
      ? +tabulator_size
      : limit && +limit;
    const use_offset = tabulator_pagination_format
      ? +tabulator_size * (+tabulator_page - 1)
      : offset && +offset;

    await passport.authenticate(
      ["api-bearer", "jwt"],
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user, table, true)) {
          let rows;
          if (versioncount === "on") {
            const joinOpts = {
              forUser: req.user || user || { role_id: 100 },
              forPublic: !(req.user || user),
              limit: use_limit,
              offset: use_offset,
              orderDesc:
                (sortDesc && sortDesc !== "false") || tabulator_dir == "desc",
              orderBy: orderByField?.name || "id",
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
          } else {
            const tbl_fields = table.getFields();
            readState(req_query, tbl_fields, req);
            const qstate = stateFieldsToWhere({
              fields: tbl_fields,
              approximate: !!approximate,
              state: req_query,
              table,
              prefix: "a.",
            });
            const joinFields = {};
            const derefs = Array.isArray(dereference)
              ? dereference
              : !dereference
                ? []
                : [dereference];
            derefs.forEach((f) => {
              const field = table.getField(f);
              if (field?.attributes?.summary_field)
                joinFields[`${f}_${field?.attributes?.summary_field}`] = {
                  ref: f,
                  target: field?.attributes?.summary_field,
                };
            });
            rows = await table.getJoinedRows({
              where: qstate,
              joinFields,
              limit: use_limit,
              offset: use_offset,
              orderDesc:
                (sortDesc && sortDesc !== "false") || tabulator_dir == "desc",
              orderBy: orderByField?.name || undefined,
              forPublic: !(req.user || user),
              forUser: req.user || user,
            });
          }
          if (tabulator_pagination_format) {
            res.json({
              last_page: Math.ceil((await table.countRows()) / +tabulator_size),
              data: rows.map(limitFields(fields)),
            });
          } else res.json({ success: rows.map(limitFields(fields)) });
        } else {
          getState().log(3, `API get ${table.name} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

/**
 * Emit Event using POST
 * This is used from the mobile app to send an event to the server.
 *
 * The user comes the JWT token and actions,
 * listening for the event, have to check on their own if the user is allowed to run it.
 */
router.post(
  "/emit-event/:eventname",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "jwt",
      { session: false },
      async function (err, user, info) {
        if (user) {
          const { eventname } = req.params;
          const { channel, payload } = req.body;
          Trigger.emitEvent(eventname, channel, user, payload);
          res.json({ success: true });
        } else {
          getState().log(3, `API POST emit-event not authorized`);
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
router.all(
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
            let resp;
            const row = req.method === "GET" ? req.query : req.body || {};
            if (trigger.action === "Workflow") {
              resp = await trigger.runWithoutRow({
                req,
                interactive: true,
                row,
                user: user || req.user,
              });
              delete resp.__wf_run_id;
            } else {
              const action = getState().actions[trigger.action];
              resp = await action.run({
                configuration: trigger.configuration,
                body: req.body || {},
                row,
                req,
                user: user || req.user,
              });
            }
            if (
              (row._process_result || req.headers?.scprocessresults) &&
              resp?.goto
            )
              res.redirect(resp.goto);
            else if (req.headers?.scgotourl)
              res.redirect(req.headers?.scgotourl);
            else {
              if (
                trigger.configuration?._raw_output &&
                trigger.configuration?._response_mime
              ) {
                res.setHeader(
                  "content-type",
                  trigger.configuration?._response_mime
                );
                res.send(resp);
              } else if (trigger.configuration?._raw_output) res.json(resp);
              else if (resp?.error) {
                const { error, ...rest } = resp;
                res.json({ success: false, error, data: rest });
              } else res.json({ success: true, data: resp });
            }
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
    const table = Table.findOne({ name: tableName });
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
          const { _versions, ...row } = req.body || {};
          const fields = table.getFields();
          readState(row, fields, req);

          const errors = await prepare_insert_row(row, fields);
          if (errors.length > 0) {
            getState().log(
              2,
              `API POST ${table.name} error: ${errors.join(", ")}`
            );
            res.status(400).json({ error: errors.join(", ") });
            return;
          }
          let ins_res = await db.withTransaction(async () => {
            return await table.tryInsertRow(
              row,
              req.user || user || { role_id: 100 }
            );
          });
          if (ins_res?.error) {
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
 * Delete Table row by ID using POST
 * @name delete/:tableName/:id
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.post(
  "/:tableName/delete/:id",
  // in case of primary key different from id - id will be string "undefined"
  error_catcher(async (req, res, next) => {
    const { tableName, id } = req.params;
    const table = Table.findOne({ name: tableName });
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
            await db.withTransaction(async () => {
              if (id === "undefined") {
                const pk_name = table.pk_name;
                //const fields = table.getFields();
                const row = req.body || {};
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
            });
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
    const table = Table.findOne({ name: tableName });
    if (!table) {
      getState().log(3, `API POST ${tableName} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      ["api-bearer", "jwt"],
      { session: false },
      async function (err, user, info) {
        if (accessAllowedWrite(req, user, table)) {
          const { _versions, ...row } = req.body || {};
          const fields = table.getFields();
          readState(row, fields, req);
          const errors = await prepare_update_row(table, row, id);
          if (errors.length > 0) {
            getState().log(
              2,
              `API POST ${table.name} error: ${errors.join(", ")}`
            );
            res.status(400).json({ error: errors.join(", ") });
            return;
          }
          let ins_res = await db.withTransaction(async () => {
            return await table.tryUpdateRow(
              row,
              id,
              user || req.user || { role_id: 100 }
            );
          });

          if (ins_res?.error) {
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
    const table = Table.findOne({ name: tableName });
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
            //await db.withTransaction(async () => {
            if (id === "undefined") {
              const pk_name = table.pk_name;
              //const fields = table.getFields();
              const row = req.body || {};
              //readState(row, fields);
              await table.deleteRows(
                { [pk_name]: row[pk_name] },
                user || req.user || { role_id: 100 }
              );
            } else
              await table.deleteRows(
                { [table.pk_name]: id },
                user || req.user || { role_id: 100 }
              );
            //});
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
