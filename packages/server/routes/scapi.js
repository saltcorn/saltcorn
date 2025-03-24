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
const { error_catcher } = require("./utils.js");
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
const {
  getState,
  process_send,
  add_tenant,
} = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const { loadAllPlugins } = require("../load_plugins");

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
 * @param {object} req httprequest
 * @param {object} user user based on access token
 * @returns {boolean}
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

// todo add paging
// todo more granular access rights for api. Currently only admin can call this api.
/**
 * List SC Views using GET
 * @name get/sc_views
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_views/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const views = await View.find({}, { cached: true });

          res.json({ success: views });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
/**
 * List SC Pages using GET
 * @name get/sc_pages
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_pages/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const pages = await Page.find({});

          res.json({ success: pages });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
/**
 * List SC Files using GET
 * @name get/sc_files
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_files/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const files = await File.find({});

          res.json({ success: files });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
/**
 * List SC Triggers using GET
 * @name get/sc_triggers
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_triggers/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const triggers = Trigger.find({});

          res.json({ success: triggers });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
/**
 * List SC Roles using GET
 * @name get/sc_roles
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_roles/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const roles = await Role.find({});

          res.json({ success: roles });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
/**
 * List SC Tenants using GET
 * @name get/sc_tenants
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_tenants/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const tenants = await Tenant.getAllTenants();

          res.json({ success: tenants });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
/**
 * List SC Plugins using GET
 * @name get/sc_plugins
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_plugins/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const plugins = await Plugin.find({});

          res.json({ success: plugins });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
/**
 * List SC Config Items using GET
 * @name get/sc_config
 * @function
 * @memberof module:routes/scapi~scapiRouter
 * @function
 */
router.get(
  "/sc_config/",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const configVars = await Config.getAllConfig();

          res.json({ success: configVars });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

router.get(
  "/reload",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          await getState().refresh_plugins();
          res.json({ success: true });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

router.post(
  "/reload",
  error_catcher(async (req, res, next) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err, user, info) {
        if (accessAllowedRead(req, user)) {
          const { tenant, new_tenant } = req.body;
          if (new_tenant) {
            add_tenant(new_tenant);

            await db.runWithTenant(new_tenant, loadAllPlugins);

            process_send({ createTenant: new_tenant });
          }
          if (tenant) {
            await db.runWithTenant(tenant, async () => {
              await getState().refresh_plugins();
            });
          } else await getState().refresh_plugins();
          res.json({ success: true });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);
