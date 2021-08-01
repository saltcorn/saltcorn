/**
 * SC service API handler
 * Allows to list tables, views, etc
 * @type {module:express-promise-router}
 */
const Router = require("express-promise-router");
//const db = require("@saltcorn/data/db");
const { setTenant, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");
const File = require("@saltcorn/data/models/file");
const Trigger = require("@saltcorn/data/models/trigger");
const Role = require("@saltcorn/data/models/role");
const Tenant = require("@saltcorn/data/models/tenant");
const Plugin = require("@saltcorn/data/models/plugin");
const Config = require("@saltcorn/data/models/config");
const passport = require("passport");

const {
  stateFieldsToWhere,
  readState,
} = require("@saltcorn/data/plugin-helper");
const router = new Router();
module.exports = router;


/**
 * Check that user has right to read sc service api data.
 * Only admin currently can call this api.
 * @param req - httprequest
 * @param user - user based on access token
 * @returns {boolean}
 */
function accessAllowedRead(req, user){
    const role = req.isAuthenticated()
        ? req.user.role_id
        : user && user.role_id
            ? user.role_id
            : 10;

    if (role === 1) return true;
    return false;
}

/**
 * List SC Tables using GET
 */
// todo add paging
// todo more granular access rights for api. Currently only admin can call this api.
// todo add support of fields
router.get(
    "/sc_tables/",
    setTenant,
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
/**
 * List SC Views using GET
 */
// todo add paging
// todo more granular access rights for api. Currently only admin can call this api.
router.get(
    "/sc_views/",
    setTenant,
    error_catcher(async (req, res, next) => {

        await passport.authenticate(
            "api-bearer",
            { session: false },
            async function (err, user, info) {
                if (accessAllowedRead(req, user)) {

                    const views = await View.find({});

                    res.json({ success: views });
                } else {
                    res.status(401).json({ error: req.__("Not authorized") });
                }
            }
        )(req, res, next);
    })
);

/**
 * List SC Pages using GET
 */
// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
router.get(
    "/sc_pages/",
    setTenant,
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
/**
 * List SC Files using GET
 */
// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
router.get(
    "/sc_files/",
    setTenant,
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
/**
 * List SC Triggers using GET
 */
// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
router.get(
    "/sc_triggers/",
    setTenant,
    error_catcher(async (req, res, next) => {

        await passport.authenticate(
            "api-bearer",
            { session: false },
            async function (err, user, info) {
                if (accessAllowedRead(req, user)) {

                    const triggers = await Trigger.find({});

                    res.json({ success: triggers });
                } else {
                    res.status(401).json({ error: req.__("Not authorized") });
                }
            }
        )(req, res, next);
    })
);
/**
 * List SC Roles using GET
 */
// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
router.get(
    "/sc_roles/",
    setTenant,
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
/**
 * List SC Tenants using GET
 */
// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
router.get(
    "/sc_tenants/",
    setTenant,
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
/**
 * List SC Plugins using GET
 */
// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
router.get(
    "/sc_plugins/",
    setTenant,
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
/**
 * List SC Config Items using GET
 */
// todo add paging
// todo more granular access rights to api. Currently only admin can call this api.
router.get(
    "/sc_config/",
    setTenant,
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