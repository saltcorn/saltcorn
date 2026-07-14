/**
 * SC service API handler
 * Allows to list tables, views, etc
 * @category server
 * @module routes/scapi
 * @subcategory routes
 */

/** @type {module:express-promise-router} */
import Router from "express-promise-router";
//const db = require("@saltcorn/data/db");
import { error_catcher, rejectTenantDrift } from "./utils.js";
import Table from "@saltcorn/data/models/table";
import View from "@saltcorn/data/models/view";
import Page from "@saltcorn/data/models/page";
import File from "@saltcorn/data/models/file";
import Trigger from "@saltcorn/data/models/trigger";
import Role from "@saltcorn/data/models/role";
import Tenant from "@saltcorn/admin-models/models/tenant";
import Plugin from "@saltcorn/data/models/plugin";
import * as Config from "@saltcorn/data/models/config";
// @ts-ignore
import passport from "passport";

import { stateFieldsToWhere, readState } from "@saltcorn/data/plugin-helper";
import { getState, process_send, add_tenant } from "@saltcorn/data/db/state";
import db from "@saltcorn/data/db";
import { text } from "@saltcorn/markup/tags";
import { Req, Res } from "@saltcorn/types/base_types";

/**
 * @type {object}
 * @const
 * @namespace scapiRouter
 * @category server
 * @subcategory routes
 */
const router = Router();
export default router;

// Reject sessions/JWTs minted in another tenant before any data is served.
router.use(rejectTenantDrift);

/**
 * Check that user has right to read sc service api data. Admins always can;
 * a plugin's `authorize_api` hook can additionally grant access to a
 * specific endpoint (identified by `route`) to non-admins.
 * @param {object} req httprequest
 * @param {object} user user based on access token
 * @param {string} route identifies which sc api endpoint is being checked
 * @returns {Promise<boolean>}
 */
async function accessAllowedRead(req: Req, user: any, route: string) {
  const role =
    req.user && req.user!.id
      ? req.user!.role_id
      : user && user.role_id
        ? user.role_id
        : 100;

  if (role === 1) return true;
  return await getState()!.authorizeApi(user || req.user, {
    route: `scapi/${route}`,
    action: "get",
    req,
  });
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_tables")) {
          const tables = (await Table.find({}))!;

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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_views")) {
          const views = (await View.find({}, { cached: true }))!;

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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_pages")) {
          const pages = (await Page.find({}))!;

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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_files")) {
          const files = (await File.find({}))!;

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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_triggers")) {
          const triggers = Trigger.find({})!;

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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_roles")) {
          const roles = (await Role.find({}))!;

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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_tenants")) {
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_plugins")) {
          const plugins = (await Plugin.find({}))!;

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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "sc_config")) {
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "reload_get")) {
          await getState()!.refresh_plugins();
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowedRead(req, user, "reload_post")) {
          const { tenant, new_tenant } = req.body;
          if (new_tenant) {
            add_tenant(new_tenant);

            await db.runWithTenant(new_tenant, Plugin.loadAllPlugins);

            process_send({ createTenant: new_tenant });
          }
          if (tenant) {
            await db.runWithTenant(tenant, async () => {
              await getState()!.refresh_plugins();
            });
          } else await getState()!.refresh_plugins();
          res.json({ success: true });
        } else {
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

router.post(
  "/run-view-route/:viewname/:route",
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        const { viewname, route } = req.params;
        req.user = user;
        const role = user?.id ? user.role_id : 100;
        const state = getState()!;
        state.log(
          3,
          `Route /view/${viewname} viewroute ${route} user=${req.user?.id}${
            state.getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
          }`
        );

        const view = View.findOne({ name: viewname })!;
        if (!view) {
          res
            .status(404)
            .json({ error: req.__(`No such view: %s`, text(viewname)) });
          state.log(2, `View ${viewname} not found`);
        } else if (
          role > view.min_role &&
          !(await view.authorize(user, {
            action: "post",
            route,
            req,
            body: req.body || {},
          }))
        ) {
          res.status(401).json({ error: req.__("Not authorized") });
          state.log(2, `View ${viewname} viewroute ${route} not authorized`);
        } else {
          await view.runRoute(route, req.body || {}, res, { res, req });
        }
      }
    )(req, res, next);
  })
);
