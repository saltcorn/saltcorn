const { error_catcher, loggedIn } = require("./utils.js");
const Router = require("express-promise-router");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");
const File = require("@saltcorn/data/models/file");
const { getSafeSaltcornCmd } = require("@saltcorn/data/utils");
const {
  freeVariables,
  add_free_variables_to_joinfields,
} = require("@saltcorn/data/models/expression");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs").promises;

const router = new Router();
module.exports = router;

router.get(
  "/sync_timestamp",
  loggedIn,
  error_catcher(async (req, res) => {
    try {
      res.json({ syncTimestamp: (await db.time()).valueOf() });
    } catch (error) {
      getState().log(2, `GET /sync_timestamp: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

// Apply ownership_formula filter to rows fetched by getSyncRows.
// For formulas that reference join fields, resolves them via a second
// getJoinedRows pass bounded to the PKs already in the result set.
const applyOwnershipFormula = async (rows, table, user) => {
  if (!rows.length) return rows;
  const pkName = table.pk_name;
  const joinFields = {};
  add_free_variables_to_joinfields(
    freeVariables(table.ownership_formula),
    joinFields,
    table.getFields()
  );
  let rowMap = null;
  if (Object.keys(joinFields).length > 0) {
    const pks = rows.map((r) => r[pkName]);
    const joinedRows = await table.getJoinedRows({
      where: { [pkName]: { in: pks } },
      joinFields,
    });
    rowMap = Object.fromEntries(joinedRows.map((r) => [r[pkName], r]));
  }
  // table.ownership_formula
  return rows.filter((row) => {
    const evalRow = rowMap ? rowMap[row[pkName]] ?? row : row;
    return table.is_owner(user, evalRow);
  });
};

const getSyncRows = async (syncInfo, table, syncUntil, user) => {
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
      .find((f) => f.id === table.ownership_field_id);
    if (!ownerField) {
      getState().log(
        5,
        `GET /load_changes: The ownership field of '${table.name}' does not exist.`
      );
      return null;
    }
    ownerFieldName = ownerField.name;
  }

  const maxLoadedId = Number(syncInfo.maxLoadedId);
  if (!Number.isInteger(maxLoadedId)) throw new Error("Invalid maxLoadedId");

  const syncUntilMs = new Date(syncUntil).valueOf();
  if (!Number.isFinite(syncUntilMs)) throw new Error("Invalid syncUntil");

  const userId = user?.id !== undefined ? parseInt(user.id, 10) : null;
  if (ownerFieldName && !Number.isFinite(userId))
    throw new Error("Invalid user id");

  const schema = db.getTenantSchemaPrefix();
  if (!syncInfo.syncFrom) {
    const params = [maxLoadedId];
    const ownerClause = ownerFieldName
      ? `and data_tbl."${db.sqlsanitize(ownerFieldName)}" = $2`
      : "";
    if (ownerFieldName) params.push(userId);
    const { rows } = await db.query(
      `select
         info_tbl.ref "_sync_info_tbl_ref_",
         info_tbl.last_modified "_sync_info_tbl_last_modified_",
         info_tbl.deleted "_sync_info_tbl_deleted_",
         data_tbl.*
       from ${schema}"${db.sqlsanitize(
        tblName
      )}_sync_info" "info_tbl" right join "${db.sqlsanitize(
        tblName
      )}" "data_tbl"
      on info_tbl.ref = data_tbl."${db.sqlsanitize(
        pkName
      )}" and info_tbl.deleted = false
      where data_tbl."${db.sqlsanitize(pkName)}" > $1
      ${ownerClause}
      order by data_tbl."${db.sqlsanitize(pkName)}"`,
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

    const params = [syncFromMs / 1000.0, syncUntilMs / 1000.0, maxLoadedId];
    const ownerClause = ownerFieldName
      ? `and data_tbl."${db.sqlsanitize(ownerFieldName)}" = $4`
      : "";
    if (ownerFieldName) params.push(userId);
    const { rows } = await db.query(
      `select
         info_tbl.ref "_sync_info_tbl_ref_",
         info_tbl.last_modified "_sync_info_tbl_last_modified_",
         info_tbl.deleted "_sync_info_tbl_deleted_",
         data_tbl.*
       from ${schema}"${db.sqlsanitize(
        tblName
      )}_sync_info" "info_tbl" join ${schema}"${db.sqlsanitize(
        tblName
      )}" "data_tbl"
      on info_tbl.ref = data_tbl."${db.sqlsanitize(pkName)}"
      where date_trunc('milliseconds', info_tbl.last_modified) > to_timestamp($1)
      and date_trunc('milliseconds', info_tbl.last_modified) < to_timestamp($2)
      and info_tbl.deleted = false
      and info_tbl.ref > $3
      ${ownerClause}
      order by info_tbl.ref`,
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
  error_catcher(async (req, res) => {
    const { syncInfos, loadUntil } = req.body || {};
    if (!loadUntil) {
      getState().log(2, `POST /load_changes: loadUntil is missing`);
      return res.status(400).json({ error: "loadUntil is missing" });
    }
    if (!syncInfos) {
      getState().log(2, `POST /load_changes: syncInfos is missing`);
      return res.status(400).json({ error: "syncInfos is missing" });
    }
    const role = req.user ? req.user.role_id : 100;
    try {
      const result = await db.withTransaction(async () => {
        let rowLimit = 1000;
        const result = {};

        for (const [tblName, syncInfo] of Object.entries(syncInfos)) {
          const table = Table.findOne({ name: tblName });
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
            } else if (table.ownership_formula) {
              // already filtered by applyOwnershipFormula inside getSyncRows
            }
          }
          if (rows.length > rowLimit) {
            rows.splice(rowLimit);
          }
          rowLimit -= rows.length;
          result[tblName] = {
            rows,
            maxLoadedId: rows.length > 0 ? rows[rows.length - 1][pkName] : 0,
          };
        }
        return result;
      });
      res.json(result);
    } catch (error) {
      getState().log(2, `POST /load_changes: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

const getDelRows = async (tblName, syncFrom, syncUntil, userId = null) => {
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
  error_catcher(async (req, res) => {
    const { syncInfos, syncTimestamp } = req.body || {};
    const role = req.user ? req.user.role_id : 100;
    try {
      const result = await db.withTransaction(async () => {
        const syncUntil = new Date(syncTimestamp);
        const result = {
          deletes: {},
        };
        for (const [tblName, syncInfo] of Object.entries(syncInfos)) {
          const table = Table.findOne({ name: tblName });
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
                req.user.id
              );
            } else {
              // ownership_formula: fetch all deletes and evaluate formula in JS
              // against the field values stored in owner_fields at delete time
              const rows = await getDelRows(
                tblName,
                new Date(syncInfo.syncFrom),
                syncUntil
              );
              result.deletes[tblName] = rows.filter((row) =>
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
    } catch (error) {
      getState().log(2, `POST /sync/deletes: '${error.message}'`);
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
  error_catcher(async (req, res) => {
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
      if (req.user?.email) spawnParams.push("--userEmail", req.user.email);
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

      child.on("exit", async (exitCode, signal) => {
        getState().log(
          5,
          `POST /sync/offline_changes: upload offline data finished with code: ${exitCode}`
        );
      });
      child.on("error", (msg) => {
        const message = msg.message ? msg.message : msg.code;
        getState().log(
          5,
          `POST /sync/offline_changes: upload offline data failed: ${message}`
        );
      });
    } catch (error) {
      getState().log(2, `POST /sync/offline_changes: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

const readOutFile = async (entries, syncDir, fileName) => {
  if (entries.indexOf(fileName) >= 0) {
    return JSON.parse(await fs.readFile(path.join(syncDir, fileName)));
  }
  return null;
};

router.get(
  "/upload_finished",
  loggedIn,
  error_catcher(async (req, res) => {
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
      } catch (error) {
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
    } catch (error) {
      getState().log(2, `GET /sync/upload_finished: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

router.post(
  "/clean_sync_dir",
  loggedIn,
  error_catcher(async (req, res) => {
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
    } catch (error) {
      getState().log(2, `POST /sync/clean_sync_dir: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

router.post(
  "/push_subscribe",
  loggedIn,
  error_catcher(async (req, res) => {
    const { token, deviceId, synchedTables, platform } = req.body || {};
    if (!token) {
      res.status(400).json({
        error: req.__("FCM token is required"),
      });
      return;
    }

    const user = req.user;
    const state = getState();
    const allSubs = state.getConfig("push_sync_subscriptions", {});
    let userSubs = allSubs[user.id] || [];
    const existingSub = userSubs.find(
      (s) => s.token === token && s.deviceId === deviceId
    );
    if (existingSub) {
      res.json({
        success: "ok",
        message: req.__("sync push subscription already exists"),
      });
    } else {
      // remove old subscriptions for this deviceId before adding
      userSubs = userSubs.filter((s) => s.deviceId !== deviceId);
      userSubs.push({
        token,
        deviceId,
        type: platform === "android" ? "fcm-push" : "apns-push",
        synchedTables,
      });
      await getState().setConfig("push_sync_subscriptions", {
        ...allSubs,
        [user.id]: userSubs,
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
  error_catcher(async (req, res) => {
    const { token, deviceId } = req.body || {};
    if (!token) {
      res.status(400).json({
        error: req.__("FCM token is required"),
      });
      return;
    }

    const user = req.user;
    const state = getState();
    const allSubs = state.getConfig("push_sync_subscriptions", {});
    let userSubs = allSubs[user.id] || [];
    const newUserSubs = userSubs.filter((s) => s.deviceId !== deviceId);
    if (newUserSubs.length === userSubs.length) {
      res.json({
        success: "ok",
        message: req.__("FCM token not found"),
      });
    } else {
      await getState().setConfig("push_sync_subscriptions", {
        ...allSubs,
        [user.id]: newUserSubs,
      });
      res.json({
        success: "ok",
        message: req.__("sync push subscription removed"),
      });
    }
  })
);
