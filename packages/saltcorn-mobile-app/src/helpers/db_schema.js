/*global saltcorn */

const historyFile = "update_history";
const sessionTableName = "session_table";

import { readFile, fileExists, writeJSON } from "./file_system";
import { Directory } from "@capacitor/filesystem";

/**
 * drop tables that are no longer in the 'tables.json' file
 * the server db uses a serial (with postgres), so checking ids should suffice
 */
export async function dropDeletedTables(incomingTables) {
  const existingTables = await saltcorn.data.models.Table.find();
  for (const table of existingTables) {
    if (
      table.name !== "users" &&
      !incomingTables.find((row) => row.id === table.id)
    ) {
      await saltcorn.data.db.query(
        `DROP TABLE "${saltcorn.data.db.sqlsanitize(table.name)}"`
      );
    }
  }
}

/**
 * pick fields that really exist
 * @param {*} table
 * @param {*} rows
 * @returns
 */
export async function safeRows(table, rows) {
  const existingFields = (
    await saltcorn.data.db.query(
      `PRAGMA table_info('${saltcorn.data.db.sqlsanitize(table)}')`
    )
  ).rows.map((row) => row.name);
  return rows.map((row) => {
    const insertRow = {};
    for (const safeField of existingFields) {
      const fromRow = row[safeField];
      if (fromRow !== null && fromRow !== undefined) {
        insertRow[safeField] = fromRow;
      }
    }
    return insertRow;
  });
}

export async function updateScTables(tablesJSON, skipScPlugins = true) {
  await saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
  for (const { table, rows } of tablesJSON.sc_tables) {
    if (
      (skipScPlugins && table === "_sc_plugins") ||
      table === "_sc_workflow_runs" ||
      table === "_sc_workflow_trace" ||
      table === "_sc_metadata" ||
      table === "_sc_api_tokens"
    )
      continue;
    if (table === "_sc_tables") await dropDeletedTables(rows);
    await saltcorn.data.db.deleteWhere(table);
    await saltcorn.data.db.insertRows(table, await safeRows(table, rows));
  }
  await saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
}

export async function updateScPlugins(tablesJSON) {
  const { table, rows } = tablesJSON.sc_tables.find(
    ({ table }) => table === "_sc_plugins"
  );
  await saltcorn.data.db.deleteWhere(table);
  for (const row of rows) {
    await saltcorn.data.db.insert(table, row);
  }
}

export async function updateUserDefinedTables() {
  const existingTables = await saltcorn.data.db.listUserDefinedTables();
  const tables = await saltcorn.data.models.Table.find({}, { cached: true });
  for (const table of tables) {
    const sanitized = saltcorn.data.db.sqlsanitize(table.name);
    if (
      table.name !== "users" &&
      !existingTables.find((row) => row.name === sanitized)
    ) {
      await saltcorn.data.models.Table.createInDb(table);
    } else {
      const existingFields = (
        await saltcorn.data.db.query(`PRAGMA table_info('${sanitized}')`)
      ).rows.map((row) => row.name);
      for (const field of table.getFields()) {
        if (
          existingFields.indexOf(saltcorn.data.db.sqlsanitize(field.name)) < 0
        ) {
          // field is new
          await saltcorn.data.models.Field.create(field, false, field.id);
        }
      }
    }
  }
}

const createSyncInfoIndexes = async (safeName) => {
  const tbl = `${safeName}_sync_info`;
  await saltcorn.data.db.query(
    `CREATE INDEX IF NOT EXISTS ${tbl}_ref_index ON ${tbl}(ref)`
  );
  await saltcorn.data.db.query(
    `CREATE INDEX IF NOT EXISTS ${tbl}_lm_index ON ${tbl}(last_modified)`
  );
  await saltcorn.data.db.query(
    `CREATE INDEX IF NOT EXISTS ${tbl}_deleted_index ON ${tbl}(deleted)`
  );
  await saltcorn.data.db.query(
    `CREATE INDEX IF NOT EXISTS ${tbl}_ml_index ON ${tbl}(modified_local)`
  );
};

// Each entry migrates sync_info tables from version (index) to version (index + 1).
// To add a migration: append a function and bump SYNC_INFO_SCHEMA_VERSION.
const SYNC_INFO_SCHEMA_VERSION = 1;

const syncInfoMigrations = [
  // v0 → v1: ref integer → ref text (UUID primary key support)
  // SQLite does not support ALTER COLUMN, so we rename → recreate → copy → drop
  async (safeName) => {
    const tbl = `${safeName}_sync_info`;
    const tmp = `${tbl}_migrate_tmp`;
    await saltcorn.data.db.query(`ALTER TABLE "${tbl}" RENAME TO "${tmp}"`);
    await saltcorn.data.db.query(`CREATE TABLE "${tbl}" (
      ref text,
      last_modified timestamp,
      deleted integer,
      modified_local integer
    )`);
    await saltcorn.data.db.query(
      `INSERT INTO "${tbl}" (ref, last_modified, deleted, modified_local)
       SELECT CAST(ref AS TEXT), last_modified, deleted, modified_local FROM "${tmp}"`
    );
    await saltcorn.data.db.query(`DROP TABLE "${tmp}"`);
    await createSyncInfoIndexes(safeName);
  },
];

export async function migrateSyncInfoTables(synchTbls) {
  const state = saltcorn.data.state.getState();
  const currentVersion =
    (await state.getConfig("sync_info_schema_version")) ?? -1;
  if (currentVersion >= SYNC_INFO_SCHEMA_VERSION) return;
  for (const synchTbl of synchTbls) {
    const safeName = saltcorn.data.db.sqlsanitize(synchTbl);
    if (!(await saltcorn.data.db.tableExists(`${safeName}_sync_info`)))
      continue;
    for (let v = currentVersion + 1; v <= SYNC_INFO_SCHEMA_VERSION; v++) {
      await syncInfoMigrations[v - 1]?.(safeName);
    }
  }
  await state.setConfig("sync_info_schema_version", SYNC_INFO_SCHEMA_VERSION);
}

export async function createSyncInfoTables(synchTbls) {
  await migrateSyncInfoTables(synchTbls);
  for (const synchTbl of synchTbls) {
    const safeName = saltcorn.data.db.sqlsanitize(synchTbl);
    const tblName = `${safeName}_sync_info`;
    if (!(await saltcorn.data.db.tableExists(tblName))) {
      await saltcorn.data.db.query(`CREATE TABLE IF NOT EXISTS ${tblName} (
        ref text,
        last_modified timestamp,
        deleted integer,
        modified_local integer
      )`);
      await createSyncInfoIndexes(safeName);
    }
  }
}

export async function tablesUptodate(createdAt, historyFile) {
  const { updated_at } = await readFile(historyFile, Directory.Data);
  if (!updated_at) {
    console.log("No updated_at in history file");
    return false;
  }
  return createdAt < updated_at;
}

/**
 * Do a table update when the history file doesn't exist or is older than createdAt
 * @param {number} createdAt UTC Date number when the tables.json file was created on the server
 */
export async function dbUpdateNeeded(createdAt) {
  return (
    !(await fileExists(historyFile, Directory.Data)) ||
    !(await tablesUptodate(createdAt, historyFile))
  );
}

export async function updateDb(tablesJSON) {
  await updateScTables(tablesJSON);
  await saltcorn.data.state.getState().refresh_tables();
  await updateUserDefinedTables();
  await writeJSON(historyFile, Directory.Data, {
    updated_at: new Date().valueOf(),
  });
}

export async function createSessionTable() {
  await saltcorn.data.db.query(`CREATE TABLE IF NOT EXISTS ${sessionTableName} (
    csrfToken VARCHAR(500),
    userJson VARCHAR(2000),
    isPublicUser BOOLEAN
  )`);
}
