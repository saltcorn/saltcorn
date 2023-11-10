const { error_catcher } = require("./utils.js");
const Router = require("express-promise-router");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");
const File = require("@saltcorn/data/models/file");
const { getSafeSaltcornCmd } = require("@saltcorn/data/utils");
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs").promises;

const router = new Router();
module.exports = router;

router.get(
  "/sync_timestamp",
  error_catcher(async (req, res) => {
    try {
      res.json({ syncTimestamp: (await db.time()).valueOf() });
    } catch (error) {
      getState().log(2, `GET /sync_timestamp: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

const getSyncRows = async (syncInfo, table, syncUntil, client, user) => {
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
  const schema = db.getTenantSchemaPrefix();
  if (!syncInfo.syncFrom) {
    const { rows } = await client.query(
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
      where data_tbl."${db.sqlsanitize(pkName)}" > ${syncInfo.maxLoadedId}
      ${ownerFieldName ? `and data_tbl."${ownerFieldName}" = ${user.id}` : ""}
      order by data_tbl."${db.sqlsanitize(pkName)}"`
    );
    for (const row of rows) {
      if (row._sync_info_tbl_last_modified_)
        row._sync_info_tbl_last_modified_ =
          row._sync_info_tbl_last_modified_.valueOf();
      else row._sync_info_tbl_last_modified_ = new Date(syncUntil).valueOf();
      row._sync_info_tbl_ref_ = row[pkName];
    }
    return rows;
  } else {
    const { rows } = await client.query(
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
      where date_trunc('milliseconds', info_tbl.last_modified) > to_timestamp(${
        new Date(syncInfo.syncFrom).valueOf() / 1000.0
      }) 
      and date_trunc('milliseconds', info_tbl.last_modified) < to_timestamp(${
        new Date(syncUntil).valueOf() / 1000.0
      }) 
      and info_tbl.deleted = false
      and info_tbl.ref > ${syncInfo.maxLoadedId}
      ${ownerFieldName ? `and data_tbl."${ownerFieldName}" = ${user.id}` : ""}
      order by info_tbl.ref`
    );
    for (const row of rows) {
      if (row._sync_info_tbl_last_modified_)
        row._sync_info_tbl_last_modified_ =
          row._sync_info_tbl_last_modified_.valueOf();
      else row._sync_info_tbl_last_modified_ = syncUntil.valueOf();
    }
    return rows;
  }
};

/*
  load inserts/updates after syncFrom
  If a table has no syncFrom then it's the first sync and we have to send everything
*/
router.post(
  "/load_changes",
  error_catcher(async (req, res) => {
    const result = {};
    const { syncInfos, loadUntil } = req.body;
    if (!loadUntil) {
      getState().log(2, `POST /load_changes: loadUntil is missing`);
      return res.status(400).json({ error: "loadUntil is missing" });
    }
    if (!syncInfos) {
      getState().log(2, `POST /load_changes: syncInfos is missing`);
      return res.status(400).json({ error: "syncInfos is missing" });
    }
    const role = req.user ? req.user.role_id : 100;
    const client = await db.getClient();
    let rowLimit = 1000;
    try {
      await client.query(`BEGIN`);
      for (const [tblName, syncInfo] of Object.entries(syncInfos)) {
        const table = Table.findOne({ name: tblName });
        if (!table) throw new Error(`The table '${tblName}' does not exists`);
        const pkName = table.pk_name;
        let rows = await getSyncRows(
          syncInfo,
          table,
          loadUntil,
          client,
          req.user
        );
        if (!rows) continue;
        if (role > table.min_role_read) {
          if (
            role === 100 ||
            (!table.ownership_field_id && !table.ownership_formula)
          )
            continue;
          else if (table.ownership_field_id) {
          } else if (table.ownership_formula) {
            rows = rows.filter((row) => table.is_owner(req.user, row));
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
      await client.query("COMMIT");
      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      getState().log(2, `POST /load_changes: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    } finally {
      client.release(true);
    }
  })
);

const getDelRows = async (tblName, syncFrom, syncUntil, client) => {
  const schema = db.getTenantSchemaPrefix();
  const dbRes = await client.query(
    `select * 
     from (
      select ref, max(last_modified) from ${schema}"${db.sqlsanitize(
      tblName
    )}_sync_info" 
      group by ref, deleted having deleted = true) as alias 
      where alias.max < to_timestamp(${syncUntil.valueOf() / 1000.0}) 
        and alias.max > to_timestamp(${syncFrom.valueOf() / 1000.0})`
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
  error_catcher(async (req, res) => {
    const { syncInfos, syncTimestamp } = req.body;
    const client = await db.getClient();
    try {
      await client.query(`BEGIN`);
      const syncUntil = new Date(syncTimestamp);
      const result = {
        deletes: {},
      };
      for (const [tblName, syncInfo] of Object.entries(syncInfos)) {
        if (syncInfo.syncFrom) {
          result.deletes[tblName] = await getDelRows(
            tblName,
            new Date(syncInfo.syncFrom),
            syncUntil,
            client
          );
        }
      }
      await client.query("COMMIT");
      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      getState().log(2, `POST /sync/deletes: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    } finally {
      client.release(true);
    }
  })
);

/*
  insert the app offline data
*/
router.post(
  "/offline_changes",
  error_catcher(async (req, res) => {
    const { changes, syncTimestamp } = req.body;
    const rootFolder = await File.rootFolder();
    try {
      const syncDirName = `${syncTimestamp}_${req.user?.email || "public"}`;
      const syncDir = path.join(
        rootFolder.location,
        "mobile_app",
        "sync",
        syncDirName
      );
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
      spawnParams.push("--syncTimestamp", syncTimestamp);

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

router.get(
  "/upload_finished",
  error_catcher(async (req, res) => {
    const { dir_name } = req.query;
    try {
      const rootFolder = await File.rootFolder();
      const syncDir = path.join(
        rootFolder.location,
        "mobile_app",
        "sync",
        dir_name
      );
      let entries = null;
      try {
        entries = await fs.readdir(syncDir);
      } catch (error) {
        return res.json({ finished: false });
      }
      if (entries.indexOf("translated-ids.json") >= 0) {
        const translatedIds = JSON.parse(
          await fs.readFile(path.join(syncDir, "translated-ids.json"))
        );
        const uniqueConflicts = JSON.parse(
          await fs.readFile(path.join(syncDir, "unique-conflicts.json"))
        );
        res.json({ finished: true, translatedIds, uniqueConflicts });
      } else if (entries.indexOf("error.json") >= 0) {
        const error = JSON.parse(
          await fs.readFile(path.join(syncDir, "error.json"))
        );
        res.json({ finished: true, error });
      } else {
        res.json({ finished: false });
      }
    } catch (error) {
      getState().log(2, `GET /sync/upload_finished: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);

router.post(
  "/clean_sync_dir",
  error_catcher(async (req, res) => {
    const { dir_name } = req.body;
    try {
      const rootFolder = await File.rootFolder();
      const syncDir = path.join(
        rootFolder.location,
        "mobile_app",
        "sync",
        dir_name
      );
      await fs.rm(syncDir, { recursive: true, force: true });
      res.status(200).send("");
    } catch (error) {
      getState().log(2, `POST /sync/clean_sync_dir: '${error.message}'`);
      res.status(400).json({ error: error.message || error });
    }
  })
);
