import { error_catcher, loggedIn } from "./utils.js";
import Router from "express-promise-router";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";
import Table from "@saltcorn/data/models/table";
import File from "@saltcorn/data/models/file";
import { getSafeSaltcornCmd } from "@saltcorn/data/utils";
import {
  freeVariables,
  add_free_variables_to_joinfields,
} from "@saltcorn/data/models/expression";
import { spawn, spawnSync } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import { Req, Res } from "@saltcorn/types/base_types";

const router = Router();
export default router;

router.get(
  "/sync_timestamp",
  loggedIn,
  error_catcher(async (req: Req, res: Res) => {
    try {
      res.json({ syncTimestamp: (await db.time()).valueOf() });
    } catch (error: any) {
      getState()!.log(2, `GET /sync_timestamp: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

// Apply ownership_formula filter to rows fetched by getSyncRows.
// For formulas that reference join fields, resolves them via a second
// getJoinedRows pass bounded to the PKs already in the result set.
const applyOwnershipFormula = async (rows: any, table: any, user: any) => {
  if (!rows.length) return rows;
  const pkName = table.pk_name;
  const joinFields: Record<string, any> = {};
  add_free_variables_to_joinfields(
    freeVariables(table.ownership_formula),
    joinFields,
    table.getFields()
  );
  let rowMap = null;
  if (Object.keys(joinFields).length > 0) {
    const pks = rows.map((r: any) => r[pkName]);
    const joinedRows = await table.getJoinedRows({
      where: { [pkName]: { in: pks } },
      joinFields,
    });
    rowMap = Object.fromEntries(joinedRows.map((r: any) => [r[pkName], r]));
  }
  // table.ownership_formula
  return rows.filter((row: any) => {
    const evalRow = rowMap ? (rowMap[row[pkName]] ?? row) : row;
    return table.is_owner(user, evalRow);
  });
};

const getSyncRows = async (syncInfo: any, table: any, syncUntil: any, user: any) => {
  const tblName = table.name;
  const pkName = table.pk_name;
  const minRole = table.min_role_read;
  const role = user?.role_id || 100;
  let ownerFieldName = null;
  if (
    role > minRole &&
    ((!table.ownership_field_id && !table.ownership_formula) || role === 100)
  )
    return null;
  if (user?.id && role < 100 && role > minRole && table.ownership_field_id) {
    const ownerField = table
      .getFields()
      .find((f: any) => f.id === table.ownership_field_id);
    if (!ownerField) {
      getState()!.log(
        5,
        `GET /load_changes: The ownership field of '${table.name}' does not exist.`
      );
      return null;
    }
    ownerFieldName = ownerField.name;
  }

  // Time-based composite cursor: (lastModifiedAt ms, lastRef string).
  // Works for both integer and UUID primary keys.
  const lastModifiedAt = Number(syncInfo.lastModifiedAt ?? 0);
  if (!Number.isInteger(lastModifiedAt) || lastModifiedAt < 0)
    throw new Error("Invalid lastModifiedAt");
  const lastRef = String(syncInfo.lastRef ?? "");

  const syncUntilMs = new Date(syncUntil).valueOf();
  if (!Number.isFinite(syncUntilMs)) throw new Error("Invalid syncUntil");

  const userId = user?.id !== undefined ? parseInt(user.id, 10) : null;
  if (ownerFieldName && !Number.isFinite(userId))
    throw new Error("Invalid user id");

  const schema = db.getTenantSchemaPrefix();
  if (!syncInfo.syncFrom) {
    // First sync: all non-deleted rows after the cursor, ordered by
    // (last_modified, ref) so pagination is stable across PK types.
    const params :any[] = [lastModifiedAt / 1000.0, lastRef];
    const ownerClause = ownerFieldName
      ? `and data_tbl."${db.sqlsanitize(ownerFieldName)}" = $3`
      : "";
    if (ownerFieldName) params.push(userId as number);
    const { rows } = await db.query(
      `select
         COALESCE(info_tbl.ref, data_tbl."${db.sqlsanitize(
           pkName
         )}"::text) "_sync_info_tbl_ref_",
         info_tbl.last_modified "_sync_info_tbl_last_modified_",
         COALESCE(info_tbl.deleted, false) "_sync_info_tbl_deleted_",
         data_tbl.*
       from ${schema}"${db.sqlsanitize(tblName)}_sync_info" "info_tbl"
       right join "${db.sqlsanitize(tblName)}" "data_tbl"
         on info_tbl.ref = data_tbl."${db.sqlsanitize(pkName)}"::text
         and info_tbl.deleted = false
       where (
           COALESCE(info_tbl.last_modified, to_timestamp(0)),
           COALESCE(info_tbl.ref, data_tbl."${db.sqlsanitize(pkName)}"::text)
         ) > (to_timestamp($1), $2)
       ${ownerClause}
       order by
         COALESCE(info_tbl.last_modified, to_timestamp(0)),
         COALESCE(info_tbl.ref, data_tbl."${db.sqlsanitize(pkName)}"::text)`,
      params
    );
    for (const row of rows) {
      if (row._sync_info_tbl_last_modified_)
        row._sync_info_tbl_last_modified_ =
          row._sync_info_tbl_last_modified_.valueOf();
      else row._sync_info_tbl_last_modified_ = syncUntilMs;
      row._sync_info_tbl_ref_ = row[pkName];
    }
    if (table.ownership_formula && role > minRole)
      return applyOwnershipFormula(rows, table, user);
    return rows;
  } else {
    const syncFromMs = new Date(syncInfo.syncFrom).valueOf();
    if (!Number.isFinite(syncFromMs)) throw new Error("Invalid syncFrom");

    // Incremental sync: rows changed in the time window, paged by
    // (last_modified, ref) within the window.
    const params = [
      syncFromMs / 1000.0,
      syncUntilMs / 1000.0,
      lastModifiedAt / 1000.0,
      lastRef,
    ];
    const ownerClause = ownerFieldName
      ? `and data_tbl."${db.sqlsanitize(ownerFieldName)}" = $5`
      : "";
    if (ownerFieldName) params.push(userId as number);
    const { rows } = await db.query(
      `select
         info_tbl.ref "_sync_info_tbl_ref_",
         info_tbl.last_modified "_sync_info_tbl_last_modified_",
         info_tbl.deleted "_sync_info_tbl_deleted_",
         data_tbl.*
       from ${schema}"${db.sqlsanitize(tblName)}_sync_info" "info_tbl"
       join ${schema}"${db.sqlsanitize(tblName)}" "data_tbl"
         on info_tbl.ref = data_tbl."${db.sqlsanitize(pkName)}"::text
       where date_trunc('milliseconds', info_tbl.last_modified) > to_timestamp($1)
         and date_trunc('milliseconds', info_tbl.last_modified) < to_timestamp($2)
         and info_tbl.deleted = false
         and (info_tbl.last_modified, info_tbl.ref) > (to_timestamp($3), $4)
       ${ownerClause}
       order by info_tbl.last_modified, info_tbl.ref`,
      params
    );
    for (const row of rows) {
      if (row._sync_info_tbl_last_modified_)
        row._sync_info_tbl_last_modified_ =
          row._sync_info_tbl_last_modified_.valueOf();
      else row._sync_info_tbl_last_modified_ = syncUntilMs;
    }
    if (table.ownership_formula && role > minRole)
      return applyOwnershipFormula(rows, table, user);
    return rows;
  }
};

/*
  load inserts/updates after syncFrom
  If a table has no syncFrom then it's the first sync and we have to send everything
*/
router.post(
  "/load_changes",
  loggedIn,
  error_catcher(async (req: Req, res: Res) => {
    const { syncInfos, loadUntil } = req.body || {};
    if (!loadUntil) {
      getState()!.log(2, `POST /load_changes: loadUntil is missing`);
      return res.status(400).json({ error: "loadUntil is missing" });
    }
    if (!syncInfos) {
      getState()!.log(2, `POST /load_changes: syncInfos is missing`);
      return res.status(400).json({ error: "syncInfos is missing" });
    }
    const role = req.user ? req.user!.role_id : 100;
    try {
      const result = await db.withTransaction(async () => {
        let rowLimit = 1000;
        const result: Record<string, any> = {};

        for (const [tblName, syncInfo] of (Object.entries(syncInfos) as [string, any][])) {
          const table = Table.findOne({ name: tblName })!;
          if (!table) throw new Error(`The table '${tblName}' does not exists`);
          if (!table.has_sync_info)
            throw new Error(`The table '${tblName}' has no sync info`);
          const pkName = table.pk_name;
          let rows = await getSyncRows(syncInfo, table, loadUntil, req.user);
          if (!rows) continue;
          if (role > table.min_role_read) {
            if (
              role === 100 ||
              (!table.ownership_field_id && !table.ownership_formula)
            )
              continue;
            else if (table.ownership_field_id) {
              // already filtered by ownership_field_id inside getSyncRows
            } else if (table.ownership_formula) {
              // already filtered by applyOwnershipFormula inside getSyncRows
            }
          }
          if (rows.length > rowLimit) {
            rows.splice(rowLimit);
          }
          rowLimit -= rows.length;
          const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
          result[tblName] = {
            rows,
            maxModifiedAt: lastRow ? lastRow._sync_info_tbl_last_modified_ : 0,
            maxRef: lastRow ? String(lastRow._sync_info_tbl_ref_ ?? "") : "",
          };
        }
        return result;
      });
      res.json(result);
    } catch (error: any) {
      getState()!.log(2, `POST /load_changes: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

const getDelRows = async (tblName: any, syncFrom: any, syncUntil: any, userId: any = null) => {
  const syncFromMs = syncFrom.valueOf();
  const syncUntilMs = syncUntil.valueOf();
  if (!Number.isFinite(syncFromMs)) throw new Error("Invalid syncFrom");
  if (!Number.isFinite(syncUntilMs)) throw new Error("Invalid syncUntil");
  const schema = db.getTenantSchemaPrefix();
  const ownerFilter =
    userId !== null ? `and alias.owner_id = ${parseInt(userId)}` : "";
  const dbRes = await db.query(
    `select *
     from (
      select ref, max(last_modified), owner_id, owner_fields from ${schema}"${db.sqlsanitize(
        tblName
      )}_sync_info"
      group by ref, deleted, owner_id, owner_fields having deleted = true) as alias
      where alias.max < to_timestamp($1)
        and alias.max > to_timestamp($2)
        ${ownerFilter}`,
    [syncUntilMs / 1000.0, syncFromMs / 1000.0]
  );
  for (const row of dbRes.rows) {
    if (row.last_modified) row.last_modified = row.last_modified.valueOf();
    if (row.max) row.max = row.max.valueOf();
  }
  return dbRes.rows;
};

/*
  load deletes after syncFrom
  If a table has no syncFrom then it's the first sync and there is nothing to delete
*/
router.post(
  "/deletes",
  loggedIn,
  error_catcher(async (req: Req, res: Res) => {
    const { syncInfos, syncTimestamp } = req.body || {};
    const role = req.user ? req.user!.role_id : 100;
    try {
      const result = await db.withTransaction(async () => {
        const syncUntil = new Date(syncTimestamp);
        const result :any= {
          deletes: {},
        };
        for (const [tblName, syncInfo] of (Object.entries(syncInfos) as [string, any][])) {
          const table = Table.findOne({ name: tblName })!;
          if (!table) throw new Error(`The table '${tblName}' does not exists`);
          if (!table.has_sync_info)
            throw new Error(`The table '${tblName}' has no sync info`);
          if (role > table.min_role_read) {
            if (!table.ownership_field_id && !table.ownership_formula) continue;
            if (!syncInfo.syncFrom) continue;
            if (table.ownership_field_id) {
              // Filter by owner_id in SQL
              result.deletes[tblName] = await getDelRows(
                tblName,
                new Date(syncInfo.syncFrom),
                syncUntil,
                req.user!.id
              );
            } else {
              // ownership_formula: fetch all deletes and evaluate formula in JS
              // against the field values stored in owner_fields at delete time
              const rows = await getDelRows(
                tblName,
                new Date(syncInfo.syncFrom),
                syncUntil
              );
              result.deletes[tblName] = rows.filter((row: any) =>
                table.is_owner(req.user, row.owner_fields || {})
              );
            }
            continue;
          }
          if (syncInfo.syncFrom) {
            result.deletes[tblName] = await getDelRows(
              tblName,
              new Date(syncInfo.syncFrom),
              syncUntil
            );
          }
        }
        return result;
      });
      res.json(result);
    } catch (error: any) {
      getState()!.log(2, `POST /sync/deletes: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

/*
  insert the app offline data
*/
router.post(
  "/offline_changes",
  loggedIn,
  error_catcher(async (req: Req, res: Res) => {
    const { changes, newSyncTimestamp, oldSyncTimestamp } = req.body || {};
    const rootFolder = await File.rootFolder();
    try {
      const syncDirName = `${newSyncTimestamp}_${req.user?.email || "public"}`;
      const syncDir = File.normalise_in_base(
        path.join(rootFolder.location, "mobile_app", "sync"),
        syncDirName
      );
      if (!syncDir) {
        return res.status(400).json({ error: "Invalid sync directory name" });
      }
      await fs.mkdir(syncDir, { recursive: true });
      await fs.writeFile(
        path.join(syncDir, "changes.json"),
        JSON.stringify(changes)
      );
      const spawnParams = ["sync-upload-data"];
      if (req.user?.email) spawnParams.push("--userEmail", req.user!.email);
      spawnParams.push("--directory", syncDir);
      if (
        db.is_it_multi_tenant() &&
        db.getTenantSchema() !== db.connectObj.default_schema
      ) {
        spawnParams.push("--tenantAppName", db.getTenantSchema());
      }
      spawnParams.push("--newSyncTimestamp", newSyncTimestamp);
      spawnParams.push("--oldSyncTimestamp", oldSyncTimestamp);
      res.json({ syncDir: syncDirName });
      const child = spawn(getSafeSaltcornCmd(), spawnParams, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: ".",
      });
      child.stdout.pipe(process.stdout);
      child.stderr.pipe(process.stderr);

      child.on("exit", async (exitCode: any, signal: any) => {
        getState()!.log(
          5,
          `POST /sync/offline_changes: upload offline data finished with code: ${exitCode}`
        );
      });
      child.on("error", (msg: any) => {
        const message = msg.message ? msg.message : msg.code;
        getState()!.log(
          5,
          `POST /sync/offline_changes: upload offline data failed: ${message}`
        );
      });
    } catch (error: any) {
      getState()!.log(2, `POST /sync/offline_changes: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

const readOutFile = async (entries: any, syncDir: any, fileName: any) => {
  if (entries.indexOf(fileName) >= 0) {
    return JSON.parse(await fs.readFile(path.join(syncDir, fileName), "utf-8"));
  }
  return null;
};

router.get(
  "/upload_finished",
  loggedIn,
  error_catcher(async (req: Req, res: Res) => {
    const { dir_name } = req.query;
    try {
      const expectedEmail = req.user?.email || "public";
      const dirMatch = dir_name ? dir_name.match(/^\d+_(.+)$/) : null;
      if (!dirMatch || dirMatch[1] !== expectedEmail) {
        return res.status(403).json({ error: "Access denied" });
      }
      const rootFolder = await File.rootFolder();
      const syncDir = File.normalise_in_base(
        path.join(rootFolder.location, "mobile_app", "sync"),
        dir_name
      );
      if (!syncDir) {
        return res.json({ finished: false });
      }
      let entries = null;
      try {
        entries = await fs.readdir(syncDir);
      } catch (error: any) {
        return res.json({ finished: false });
      }
      const translatedIds = await readOutFile(
        entries,
        syncDir,
        "translated-ids.json"
      );
      const uniqueConflicts = await readOutFile(
        entries,
        syncDir,
        "unique-conflicts.json"
      );
      const dataConflicts = await readOutFile(
        entries,
        syncDir,
        "data-conflicts.json"
      );
      const error = await readOutFile(entries, syncDir, "error.json");
      if (error) {
        res.json({ finished: true, error });
      } else if (translatedIds && uniqueConflicts && dataConflicts) {
        // all files complete
        // the syncer writes into a temp file and then renames it when complete
        res.json({
          finished: true,
          translatedIds,
          uniqueConflicts,
          dataConflicts,
        });
      } else res.json({ finished: false });
    } catch (error: any) {
      getState()!.log(2, `GET /sync/upload_finished: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

router.post(
  "/clean_sync_dir",
  loggedIn,
  error_catcher(async (req: Req, res: Res) => {
    const { dir_name } = req.body || {};
    try {
      const expectedEmail = req.user?.email || "public";
      const dirMatch = dir_name ? dir_name.match(/^\d+_(.+)$/) : null;
      if (!dirMatch || dirMatch[1] !== expectedEmail) {
        return res.status(403).json({ error: "Access denied" });
      }
      const rootFolder = await File.rootFolder();
      const syncDir = File.normalise_in_base(
        path.join(rootFolder.location, "mobile_app", "sync"),
        dir_name
      );
      if (syncDir) await fs.rm(syncDir, { recursive: true, force: true });
      res.status(200).send("");
    } catch (error: any) {
      getState()!.log(2, `POST /sync/clean_sync_dir: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

router.post(
  "/push_subscribe",
  loggedIn,
  error_catcher(async (req: Req, res: Res) => {
    const { token, deviceId, synchedTables, platform, apnsEnvironment } =
      req.body || {};
    if (!token) {
      res.status(400).json({
        error: req.__("FCM token is required"),
      });
      return;
    }
    if (platform !== "android" && platform !== "ios") {
      res.status(400).json({
        error: req.__("Invalid platform, must be 'android' or 'ios'"),
      });
      return;
    }

    const user = req.user!;
    const state = getState()!;
    const allSubs = state.getConfig("push_sync_subscriptions", {});
    let userSubs = allSubs[user.id!] || [];
    const existingSub = userSubs.find(
      (s: any) => s.token === token && s.deviceId === deviceId
    )!;
    if (existingSub) {
      res.json({
        success: "ok",
        message: req.__("sync push subscription already exists"),
      });
    } else {
      // remove old subscriptions for this deviceId before adding
      userSubs = userSubs.filter((s: any) => s.deviceId !== deviceId);
      userSubs.push({
        token,
        deviceId,
        type: platform === "android" ? "fcm-push" : "apns-push",
        synchedTables,
        ...(platform !== "android" && {
          apnsEnvironment: apnsEnvironment || "production",
        }),
      });
      await getState()!.setConfig("push_sync_subscriptions", {
        ...allSubs,
        [user.id!]: userSubs,
      });
      res.json({
        success: "ok",
        message: req.__("sync push subscription saved"),
      });
    }
  })
);

router.post(
  "/push_unsubscribe",
  loggedIn,
  error_catcher(async (req: Req, res: Res) => {
    const { token, deviceId } = req.body || {};
    if (!token) {
      res.status(400).json({
        error: req.__("FCM token is required"),
      });
      return;
    }

    const user = req.user!;
    const state = getState()!;
    const allSubs = state.getConfig("push_sync_subscriptions", {});
    let userSubs = allSubs[user.id!] || [];
    const newUserSubs = userSubs.filter((s: any) => s.deviceId !== deviceId);
    if (newUserSubs.length === userSubs.length) {
      res.json({
        success: "ok",
        message: req.__("FCM token not found"),
      });
    } else {
      await getState()!.setConfig("push_sync_subscriptions", {
        ...allSubs,
        [user.id!]: newUserSubs,
      });
      res.json({
        success: "ok",
        message: req.__("sync push subscription removed"),
      });
    }
  })
);
