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
import Router from "express-promise-router";
import db from "@saltcorn/data/db";
import { error_catcher, rejectTenantDrift } from "./utils.js";
//const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
import { getState } from "@saltcorn/data/db/state";
import {
  prepare_update_row,
  prepare_insert_row,
} from "@saltcorn/data/web-mobile-commons";
import Table from "@saltcorn/data/models/table";
import View from "@saltcorn/data/models/view";
//const Field = require("@saltcorn/data/models/field");
import Trigger from "@saltcorn/data/models/trigger";
import File from "@saltcorn/data/models/file";
//const load_plugins = require("../load_plugins");
// @ts-ignore
import passport from "passport";
import path from "path";
import s3storage from "../s3storage.js";
import { getSafeSaltcornCmd } from "@saltcorn/data/utils";
import { spawn } from "child_process";
import { tmpdir } from "os";
import fs from "fs";
import crypto from "crypto";

import {
  readState,
  strictParseInt,
  stateFieldsToWhere,
} from "@saltcorn/data/plugin-helper";
import Crash from "@saltcorn/data/models/crash";
import { Req, Res } from "@saltcorn/types/base_types";
import { AbstractUser } from "@saltcorn/types/model-abstracts/abstract_user";

/**
 * @type {object}
 * @const
 * @namespace apiRouter
 * @category server
 * @subcategory routes
 */
const router = Router();
export default router;

/**
 * @param {*} fields
 * @returns {*}
 */
const limitFields = (fields: any) => (r: any) => {
  if (fields) {
    let res: Record<string, any> = {};

    fields.split(",").forEach((f: any) => {
      res[f] = r[f];
    });
    return res;
  } else {
    return r;
  }
};

/**
 * Check that user potentially has right to read table data (only read in terms of CRUD). In case of ownership fields/formula, further checks are needed.
 * @param {object} req httprequest
 * @param {object} user - user based on access token
 * @param {Table} table
 * @returns {boolean}
 */
function potentiallyAccessAllowedRead(
  req: Req,
  user: AbstractUser,
  table: Table,
  allow_ownership?: boolean
) {
  const role =
    req.user && req.user!.id
      ? req.user!.role_id
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
 * Check that user potentially has right to write table data (create, update, delete in terms of  CRUD). In case of ownership fields/formula, further checks are needed.
 * @param {object} req httprequest
 * @param {object} user user based on access token
 * @param {Table} table
 * @returns {boolean}
 */
function potentiallyAccessAllowedWrite(req: Req, user: any, table: any) {
  const role =
    req.user && req.user!.id
      ? req.user!.role_id
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
async function accessAllowed(req: Req, user: any, trigger: any) {
  const role =
    req.user && req.user!.id
      ? req.user!.role_id
      : user && user.role_id
        ? user.role_id
        : 100;

  if (role <= trigger.min_role) return true;
  const action = req.method === "GET" ? "get" : "post";
  return await trigger.authorize(user || req.user, {
    action,
    req,
    state: action === "get" ? req.query : undefined,
    body: action === "post" ? req.body : undefined,
  });
}

const getFlashes = (req: Req) =>
  ["error", "success", "danger", "warning", "information"]
    .map((type: any) => {
      return { type, msg: req.flash(type) };
    })
    .filter((a: any) => a.msg && a.msg.length && a.msg.length > 0);

// Reject sessions minted in another tenant before any data is served.
router.use(rejectTenantDrift);

router.use(
  error_catcher(async (req: Req, res: Res, next: any) => {
    const state = getState()!;
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );
    if (maintenanceModeEnabled && (!req.user || req.user!.role_id > 1)) {
      res.status(503).json({ error: "in maintenance mode" });
      return;
    }
    next();
  })
);

router.post(
  "/viewQuery/:viewName/:queryName",
  error_catcher(async (req: Req, res: Res, next: any) => {
    let { viewName, queryName } = req.params;
    const view = (await View.findOne({ name: viewName }))!;
    if (!view) {
      getState()!.log(3, `API viewQuery ${viewName} not found`);
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
    // req.user is already set from the session by app.js's auth middleware.
    const user = req.user;
    const role = user && user.id ? user.role_id : 100;
    if (
      role <= view.min_role ||
      (await view.authorize(user, { action: "get", req })) // TODO set query to state
    ) {
      const queries = view.queries(false, req, res);
      if (Object.prototype.hasOwnProperty.call(queries, queryName)) {
        const { args } = req.body || {};
        const resp = await queries[queryName](...args, true);
        res.json({ success: resp, alerts: getFlashes(req) });
      } else {
        getState()!.log(3, `API viewQuery ${view.name} ${queryName} not found`);
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
      getState()!.log(3, `API viewQuery ${view.name} not authorized`);
      res.status(401).json({ error: req.__("Not authorized") });
    }
  })
);

router.get(
  "/serve-files/*serve_path",
  //passport.authenticate("api-bearer", { session: false }),
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        const role = req?.user?.role_id || user?.role_id || 100;
        const user_id = req?.user?.id || user?.id;
        const serve_path = path.join(...req.params.serve_path);
        const file = (await File.findOne(serve_path))!;
        if (
          file &&
          (role <= file.min_role_read || (user_id && user_id === file.user_id))
        ) {
          if (file.s3_store) {
            await s3storage.redirectToObject(file, res, false);
            return;
          }
          res.type(file.mimetype);
          const cacheability =
            file.min_role_read === 100 ? "public" : "private";
          const maxAge = getState()!.getConfig("files_cache_maxage", 86400);
          res.set("Cache-Control", `${cacheability}, max-age=${maxAge}`);
          res.sendFile(file.location, { dotfiles: "allow" });
        } else {
          res.status(404).json({ error: req.__("Not found") });
        }
      }
    )(req, res, next);
  })
);

/**
 * Upload Files using POST
 * @name post/upload-files
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.post(
  "/upload-files",
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      ["api-bearer"],
      { session: false },
      async function (err: any, user: any, info: any) {
        const authUser = req.user || user;
        let jsonResp: Record<string, any> = {};
        const min_role_upload = getState()!.getConfig("min_role_upload", 1);
        const role = authUser && authUser.id ? authUser.role_id : 100;
        if (role > +min_role_upload) {
          jsonResp = { error: "Not authorized" };
          res.status(401).json(jsonResp);
          return;
        }
        if (!req.files || !req.files.file) {
          res.status(400).json({ error: "No file found" });
          return;
        }
        const { folder } = req.body || {};
        const min_role_read = req.body?.min_role_read || 1;
        try {
          const f = await File.from_req_files(
            req.files.file,
            authUser.id,
            +min_role_read,
            folder ? File.normalise(folder) : undefined
          );
          const many = Array.isArray(f);
          const formatLocation = (fl: any) =>
            File.fieldValueFromRelative(fl.path_to_serve);
          const formatUrl = (loc: any, filename: any) =>
            File.pathToServeUrl(loc, { filename });
          jsonResp = {
            success: {
              filename: many ? f.map((fl: any) => fl.filename) : f.filename,
              location: many
                ? f.map((fl: any) => formatLocation(fl))
                : formatLocation(f),
              url: many
                ? f.map((fl: any) => formatUrl(formatLocation(fl), fl.filename))
                : formatUrl(formatLocation(f), f.filename),
            },
          };
          res.json(jsonResp);
        } catch (e: any) {
          console.error(e);
          res.status(500).json({ error: e.message });
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    let { tableName, fieldName } = req.params;
    const table = Table.findOne(
      strictParseInt(tableName)
        ? { id: strictParseInt(tableName) }
        : { name: tableName }
    )!;
    if (!table) {
      res.status(404).json({ error: req.__("Not found") });
      return;
    }

    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (potentiallyAccessAllowedRead(req, user, table)) {
          const myReq = { user: user || req.user, __: req.__ };
          const field = table
            .getFields()
            .find((f: any) => f.name === fieldName);
          if (!field) {
            res.status(404).json({ error: req.__("Not found") });
            return;
          }
          let dvs: any;
          if (
            field.is_fkey ||
            (field.type_name === "String" && field.attributes?.options)
          ) {
            dvs = await field.distinct_values(myReq);
          } else {
            dvs = await table.distinctValues(fieldName, {}, user || req.user);
          }
          res.json({ success: dvs });
        } else {
          getState()!.log(
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

function validateNumberMin(value: any, min: any) {
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

// on disk, per-tenant dir: visible to all workers, safe from cross-tenant access
const BUILD_BUNDLE_JOB_TTL_MS = 30 * 60 * 1000;
const BUILD_BUNDLE_JOBS_ROOT = path.join(tmpdir(), "sc-mobile-build-jobs");
const safeTenantDirName = (tenant: string) =>
  tenant.replace(/[^a-zA-Z0-9_-]/g, "_");
const buildBundleJobPaths = (tenant: string, jobId: string) => {
  const dir = path.join(BUILD_BUNDLE_JOBS_ROOT, safeTenantDirName(tenant));
  return {
    zip: path.join(dir, `${jobId}.zip`),
    // build-app writes here first - "zip" only appears once it's renamed
    // into place below, so existsSync(zip) can't observe a half-written file
    part: path.join(dir, `${jobId}.zip.part`),
    error: path.join(dir, `${jobId}.error.txt`),
  };
};
// any worker can run this - deleting an already-deleted file is a no-op
const sweepBuildBundleJobs = async () => {
  if (!fs.existsSync(BUILD_BUNDLE_JOBS_ROOT)) return;
  for (const tenantDir of await fs.promises.readdir(BUILD_BUNDLE_JOBS_ROOT)) {
    const dir = path.join(BUILD_BUNDLE_JOBS_ROOT, tenantDir);
    for (const file of await fs.promises.readdir(dir)) {
      const full = path.join(dir, file);
      try {
        const { mtimeMs } = await fs.promises.stat(full);
        if (Date.now() - mtimeMs > BUILD_BUNDLE_JOB_TTL_MS)
          await fs.promises.rm(full, { force: true });
      } catch {}
    }
  }
};
// .catch, not awaited - an unhandled rejection here would crash the process
setInterval(() => sweepBuildBundleJobs().catch(() => {}), 10 * 60 * 1000).unref?.();

// shared bearer-auth + admin-role check for the three build-bundle routes below
const withAdminBearer =
  (handler: (req: Req, res: Res) => Promise<void>) =>
  error_catcher(async (req: Req, res: Res, next: any) => {
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        const authUser = req.user || user;
        if (!authUser || authUser.role_id !== 1) {
          res.status(401).json({ error: req.__("Not authorized") });
          return;
        }
        await handler(req, res);
      }
    )(req, res, next);
  });

/**
 * Admin-only: starts a background build; poll .../status then fetch .../result.
 * Must stay above /:tableName routes below (they'd shadow it).
 * @name post/mobile-app/build-bundle
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.post(
  "/mobile-app/build-bundle",
  withAdminBearer(async (req: Req, res: Res) => {
    const asList = (q: any): string[] | undefined =>
      Array.isArray(q) ? q : typeof q === "string" ? q.split(",") : undefined;
    const includedPlugins = asList(req.query.includedPlugins);
    const platforms = asList(req.query.platforms);
    const synchedTables = asList(req.query.synchedTables);
    const q = req.query as Record<string, string | undefined>;
    // this server's own triggers, not the build machine's
    const receiveShareTriggers = Trigger.find({
      when_trigger: "ReceiveMobileShareData",
    })!;
    const allowShareTo = receiveShareTriggers.length > 0;

    const tenant = db.getTenantSchema(); // capture now, not in the callbacks below
    const jobId = crypto.randomUUID();
    const { zip: tmpZip, part: tmpZipPart, error: tmpError } =
      buildBundleJobPaths(tenant, jobId);
    await fs.promises.mkdir(path.dirname(tmpZip), { recursive: true });
    res.json({ job_id: jobId });

    const args = ["build-app", "--remoteBundleOutput", tmpZipPart];
    if (includedPlugins?.length)
      args.push("--includedPlugins", ...includedPlugins);
    if (platforms?.length) args.push("--platforms", ...platforms);
    if (synchedTables?.length) args.push("--synchedTables", ...synchedTables);
    if (q.entryPoint) args.push("--entryPoint", q.entryPoint);
    if (q.entryPointType) args.push("--entryPointType", q.entryPointType);
    if (q.serverURL) args.push("--serverURL", q.serverURL);
    if (q.splashPage) args.push("--splashPage", q.splashPage);
    // server's own tenant, not client-supplied - avoids cross-tenant builds
    if (db.is_it_multi_tenant() && tenant !== db.connectObj.default_schema)
      args.push("--tenantAppName", tenant);
    if (q.buildType) args.push("--buildType", q.buildType);
    if (q.autoPublicLogin) args.push("--autoPublicLogin", q.autoPublicLogin);
    if (q.showContinueAsPublicUser === "true")
      args.push("--showContinueAsPublicUser");
    if (q.allowOfflineMode)
      args.push("--allowOfflineMode", q.allowOfflineMode);
    if (q.syncOnReconnect === "true") args.push("--syncOnReconnect");
    if (q.syncOnAppResume === "true") args.push("--syncOnAppResume");
    if (q.pushSync === "true") args.push("--pushSync");
    if (q.syncInterval) args.push("--syncInterval", q.syncInterval);
    if (q.pushSyncHeartbeatInterval)
      args.push("--pushSyncHeartbeatInterval", q.pushSyncHeartbeatInterval);
    if (allowShareTo) args.push("--allowShareTo");

    // response is already sent - this runs in the background
    const child = spawn(getSafeSaltcornCmd(), args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const finish = async (status: number | null, spawnError?: Error) => {
      if (status !== 0 || spawnError) {
        // the useful part could be in either stream
        const detail =
          [stdout, stderr, spawnError?.message].filter(Boolean).join("\n") ||
          `exit code ${status}`;
        await fs.promises.writeFile(
          tmpError,
          `build-app --remoteBundleOutput failed:\n${detail}`
        );
        await fs.promises.rm(tmpZipPart, { force: true });
      } else {
        // atomic: existsSync(tmpZip) can now only see a fully-written file
        await fs.promises.rename(tmpZipPart, tmpZip);
      }
    };
    // not awaited - these are event listeners; .catch to avoid an unhandled rejection
    child.on("error", (spawnError) => finish(null, spawnError).catch(() => {}));
    child.on("close", (status) => finish(status).catch(() => {}));
  })
);

/**
 * Admin-only: poll for a build-bundle job started via POST .../build-bundle.
 * @name get/mobile-app/build-bundle/status
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.get(
  "/mobile-app/build-bundle/status",
  withAdminBearer(async (req: Req, res: Res) => {
    const { zip, error } = buildBundleJobPaths(
      db.getTenantSchema(),
      req.query.job_id as string
    );
    if (fs.existsSync(zip)) res.json({ status: "done" });
    else if (fs.existsSync(error))
      res.json({
        status: "error",
        error: await fs.promises.readFile(error, "utf8"),
      });
    // unknown job_id also lands here - client's poll deadline is the backstop
    else res.json({ status: "running" });
  })
);

/**
 * Admin-only: fetch the finished zip for a build-bundle job. Deletes the
 * job's files once served.
 * @name get/mobile-app/build-bundle/result
 * @function
 * @memberof module:routes/api~apiRouter
 */
router.get(
  "/mobile-app/build-bundle/result",
  withAdminBearer(async (req: Req, res: Res) => {
    const { zip, error } = buildBundleJobPaths(
      db.getTenantSchema(),
      req.query.job_id as string
    );
    if (!fs.existsSync(zip)) {
      res.status(409).json({
        error: fs.existsSync(error)
          ? await fs.promises.readFile(error, "utf8")
          : "Build not finished",
      });
      return;
    }
    res.set("Content-Type", "application/zip");
    res.set(
      "Content-Disposition",
      `attachment; filename="mobile-build-bundle.zip"`
    );
    // stream instead of readFileSync - the bundle can be large and would block the event loop
    fs.createReadStream(zip)
      .pipe(res as any)
      .on("close", () => {
        fs.promises.rm(zip, { force: true }).catch(() => {});
        fs.promises.rm(error, { force: true }).catch(() => {});
      });
  })
);

router.get(
  "/:tableName/",
  //passport.authenticate("api-bearer", { session: false }),
  error_catcher(async (req: Req, res: Res, next: any) => {
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
    let tabulator_size: any,
      tabulator_page: any,
      tabulator_sort: any,
      tabulator_dir: any;
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
        getState()!.log(3, `API get ${tableName} Invalid limit parameter`);
        return res.status(400).json({ error: "Invalid limit parameter" });
      }
    if (typeof offset !== "undefined")
      if (isNaN(offset) || !validateNumberMin(offset, 0)) {
        getState()!.log(3, `API get ${tableName} Invalid offset parameter`);
        return res.status(400).json({ error: "Invalid offset parameter" });
      }
    const strictIntId = strictParseInt(tableName);
    let table = Table.findOne(
      strictIntId ? { id: strictParseInt(tableName) } : { name: tableName }
    )!;
    if (strictIntId && !table) table = Table.findOne({ name: tableName })!;
    if (!table) {
      getState()!.log(3, `API get ${tableName} table not found`);
      getState()!.log(
        6,
        `API get failure additonal info: URL=${req.originalUrl}${
          getState()!.getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
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
      ["api-bearer"],
      { session: false },
      async function (err: any, user: any, info: any) {
        if (potentiallyAccessAllowedRead(req, user, table, true)) {
          let rows: any;
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
                  ref: table.pk_name,
                  field: table.pk_name,
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
              user: req.user || user,
            });
            const joinFields: Record<string, any> = {};
            const derefs = Array.isArray(dereference)
              ? dereference
              : !dereference
                ? []
                : [dereference];
            derefs.forEach((f: any) => {
              const field = table.getField(f)!;
              if (field?.attributes?.summary_field)
                joinFields[`${f}_${field?.attributes?.summary_field}`] = {
                  ref: f,
                  target: field?.attributes?.summary_field,
                };
            });
            try {
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
            } catch (e: any) {
              console.error(e);
              res.json({ error: "API error" });
              return;
            }
          }
          if (tabulator_pagination_format) {
            const count = await table.countRows();
            if (count === null)
              res.json({
                data: rows.map(limitFields(fields)),
              });
            else
              res.json({
                last_page: Math.ceil(count / +tabulator_size),
                data: rows.map(limitFields(fields)),
              });
          } else res.json({ success: rows.map(limitFields(fields)) });
        } else {
          getState()!.log(3, `API get ${table.name} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);

router.get(
  "/:tableName/count",
  error_catcher(async (req: Req, res: Res, next: any) => {
    const { tableName } = req.params;
    const { approximate, ...req_query } = req.query;

    const table = Table.findOne(
      strictParseInt(tableName)
        ? { id: strictParseInt(tableName) }
        : { name: tableName }
    )!;
    if (!table) {
      getState()!.log(3, `API get ${tableName} table not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      ["api-bearer"],
      { session: false },
      async function (err: any, user: any, info: any) {
        if (potentiallyAccessAllowedRead(req, user, table)) {
          const tbl_fields = table.getFields();
          readState(req_query, tbl_fields, req);
          const qstate = stateFieldsToWhere({
            fields: tbl_fields,
            approximate: !!approximate,
            state: req_query,
            table,
            prefix: "a.",
            user: req.user || user,
          });
          const count = await table.countRows(qstate);
          res.json({ success: count });
        } else {
          getState()!.log(3, `API get ${table.name} not authorized`);
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
 * Authenticated users may only emit events listed in the
 * `mobile_emit_allowed_events` config.
 * Public users (role_id=100, no id) may only emit events listed in the
 * `mobile_emit_public_events` config (default: empty — disabled).
 */
router.post(
  "/emit-event/:eventname",
  error_catcher(async (req: Req, res: Res, next: any) => {
    // req.user is already set from the session by app.js; no user means public/anonymous.
    const user = req.user;
    const { eventname } = req.params;
    const { channel, payload } = req.body;
    const state = getState()!;
    if (!user?.id) {
      // public user — only allowed if explicitly configured
      const publicAllowed = state.getConfig("mobile_emit_public_events", []);
      if (!publicAllowed.includes(eventname)) {
        state.log(3, `API POST emit-event not authorized for public user`);
        return res.status(401).json({ error: req.__("Not authorized") });
      }
    } else {
      // authenticated user — ReceiveMobileShareData always allowed, rest requires config
      const configAllowed = state.getConfig("mobile_emit_allowed_events", []);
      if (
        eventname !== "ReceiveMobileShareData" &&
        !configAllowed.includes(eventname)
      ) {
        state.log(
          3,
          `API POST emit-event: event type '${eventname}' not allowed`
        );
        return res.status(403).json({ error: req.__("Event type not allowed") });
      }
    }
    Trigger.emitEvent(eventname, channel, user, payload);
    res.json({ success: true });
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    const { actionname } = req.params;

    const trigger = (await Trigger.findOne({
      name: actionname,
      when_trigger: "API call",
    }))!;

    if (!trigger) {
      getState()!.log(3, `API action ${actionname} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (await accessAllowed(req, user, trigger)) {
          try {
            let resp: any;
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
              resp = await trigger.runWithoutRow({
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
          } catch (e: any) {
            Crash.create(e, req);
            res.status(400).json({ success: false, error: e.message });
          }
        } else {
          getState()!.log(3, `API action ${actionname} not authorized`);
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    const { tableName } = req.params;
    const table = Table.findOne({ name: tableName })!;
    if (!table) {
      getState()!.log(3, `API POST ${tableName} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (potentiallyAccessAllowedWrite(req, user, table)) {
          const { _versions, ...row } = req.body || {};
          const fields = table.getFields();
          readState(row, fields, req);

          const errors = await prepare_insert_row(row, fields);
          if (errors.length > 0) {
            getState()!.log(
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
            getState()!.log(
              2,
              `API POST ${table.name} error: ${ins_res.error}`
            );
            res.status(400).json(ins_res);
          } else res.json(ins_res);
        } else {
          getState()!.log(3, `API POST ${table.name} not authorized`);
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    const { tableName, id } = req.params;
    const table = Table.findOne({ name: tableName })!;
    if (!table) {
      getState()!.log(3, `API DELETE ${tableName} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (potentiallyAccessAllowedWrite(req, user, table)) {
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
          } catch (e: any) {
            getState()!.log(2, `API DELETE ${table.name} error: ${e.message}`);
            res.status(400).json({ error: e.message });
          }
        } else {
          getState()!.log(3, `API DELETE ${table.name} not authorized`);
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    const { tableName, id } = req.params;
    const table = Table.findOne({ name: tableName })!;
    if (!table) {
      getState()!.log(3, `API POST ${tableName} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      ["api-bearer"],
      { session: false },
      async function (err: any, user: any, info: any) {
        if (potentiallyAccessAllowedWrite(req, user, table)) {
          const { _versions, ...row } = req.body || {};
          const fields = table.getFields();
          readState(row, fields, req);
          const errors = await prepare_update_row(table, row, id);
          if (errors.length > 0) {
            getState()!.log(
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
            getState()!.log(
              2,
              `API POST ${table.name} error: ${ins_res.error}`
            );
            res.status(400).json(ins_res);
          } else res.json(ins_res);
        } else {
          getState()!.log(3, `API POST ${table.name} not authorized`);
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
  error_catcher(async (req: Req, res: Res, next: any) => {
    const { tableName, id } = req.params;
    const table = Table.findOne({ name: tableName })!;
    if (!table) {
      getState()!.log(3, `API DELETE ${tableName} not found`);
      res.status(404).json({ error: req.__("Not found") });
      return;
    }
    await passport.authenticate(
      "api-bearer",
      { session: false },
      async function (err: any, user: any, info: any) {
        if (potentiallyAccessAllowedWrite(req, user, table)) {
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
          } catch (e: any) {
            getState()!.log(2, `API DELETE ${table.name} error: ${e.message}`);
            res.status(400).json({ error: e.message });
          }
        } else {
          getState()!.log(3, `API DELETE ${table.name} not authorized`);
          res.status(401).json({ error: req.__("Not authorized") });
        }
      }
    )(req, res, next);
  })
);
