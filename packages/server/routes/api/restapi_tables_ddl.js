/**
 * SC service API handler
 * Allows to list tables, views, etc
 * @category server
 * @module routes/scapi
 * @subcategory routes
 */

/** @type {module:express-promise-router} */
const Router = require("express-promise-router");
//const db = require("@saltcorn/data/db");
const { error_catcher } = require("../utils.js");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");
const File = require("@saltcorn/data/models/file");
const Trigger = require("@saltcorn/data/models/trigger");
const Role = require("@saltcorn/data/models/role");
const Tenant = require("@saltcorn/admin-models/models/tenant");
const Plugin = require("@saltcorn/data/models/plugin");
const Config = require("@saltcorn/data/models/config");
const passport = require("passport");

const {
  stateFieldsToWhere,
  readState,
} = require("@saltcorn/data/plugin-helper");

/**
 * @type {object}
 * @const
 * @namespace scapiRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * Check that user has right to read sc service api data.
 * Only admin currently can call this api.
 * 
 * @param {*} req http request
 * @param {*} user user based on access token
 * @returns 
 */
function accessAllowedRead(req, user) {
  const role =
    req.user && req.user.id
      ? req.user.role_id
      : user && user.role_id
      ? user.role_id
      : 100;

  if (role === 1) return true;
  return false;
}
/**
 * ! Not implemented et!
 * Check that user has right to write sc service api data.
 * Only admin currently can call this api.
 * 
 * @param {*} req http request
 * @param {*} user user based on access token
 * @returns 
 */
function accessAllowedWrite(req, user) {
  const role =
    req.user && req.user.id
      ? req.user.role_id
      : user && user.role_id
      ? user.role_id
      : 100;

  if (role === 1) return true;
  return false;
}
// todo add paging
// todo more granular access rights for api. Currently only admin can call this api.
// todo add support of fields
/**
 * List SC Tables using GET
 * @name get/sc_tables
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_tables/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const tables = await Table.find({});

          res.json({ success: tables });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);


// GET /sc_tables/:id
router.get(
  "/:id",
  error_catcher(async (req, res, next) => {
    await passport.authenticate("api-bearer", { session: false }, async function (err, user, info) {
      if (accessAllowedRead(req, user)) {
        // const table = await Table.findById
        const table = await Table.findOne(req.params.id);
        if (!table) {
          return res.status(404).json({ error: req.__("Table not found") });
        }
        res.json(table);
      } else {
        res.status(401).json({ error: req.__("Not authorized") });
      }
    })(req, res, next);
  })
);


// PUT /sc_tables/:id
router.put(
  "/:id",
  error_catcher(async (req, res, next) => {
    await passport.authenticate("api-bearer", { session: false }, async function (err, user, info) {
      if (accessAllowedWrite(req, user)) {
        const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!table) {
          return res.status(404).json({ error: req.__("Table not found") });
        }
        res.json(table);
      } else {
        res.status(401).json({ error: req.__("Not authorized") });
      }
    })(req, res, next);
  })
);



// DELETE /sc_tables/:id
router.delete(
  "/:id",
  error_catcher(async (req, res, next) => {
    await passport.authenticate("api-bearer", { session: false }, async function (err, user, info) {
      if (accessAllowedWrite(req, user)) {
        //const table = await Table.findByIdAndRemove(req.params.id);
        const table = Table.findOne(req.params.id);
        if (!table) {
          return res.status(404).json({ error: req.__("Table not found") });
        }
        try{
          await Table.delete();
        }
        catch (e){
          return res.status(404).json({ error: req.__("Exception on table deletion") });
        }
        res.json({ success: req.__("Table deleted successfully") });
      } else {
        res.status(401).json({ error: req.__("Not authorized") });
      }
    })(req, res, next);
  })
);
