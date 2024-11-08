/*global saltcorn, cordova*/

const historyFile = "update_history";
const jwtTableName = "jwt_table";

import { read_new, fileExists_new, writeJSON_new } from "./file_system";

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
    if (skipScPlugins && table === "_sc_plugins") continue;
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
  const tables = await saltcorn.data.models.Table.find();
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

export async function createSyncInfoTables(synchTbls) {
  const infoTbls = (await saltcorn.data.db.listTables()).filter(({ name }) => {
    name.endsWith("_sync_info");
  });
  for (const synchTbl of synchTbls) {
    if (!infoTbls.find(({ name }) => name.startsWith(synchTbl))) {
      await saltcorn.data.db
        .query(`CREATE TABLE IF NOT EXISTS ${saltcorn.data.db.sqlsanitize(
        synchTbl
      )}_sync_info (
          ref integer,
          last_modified timestamp,
          deleted integer,
          modified_local integer
      )`);
      await saltcorn.data.db.query(
        `CREATE INDEX IF NOT EXISTS ${saltcorn.data.db.sqlsanitize(
          synchTbl
        )}_sync_info_ref_index on ${saltcorn.data.db.sqlsanitize(
          synchTbl
        )}_sync_info(ref);`
      );
      await saltcorn.data.db.query(
        `CREATE INDEX IF NOT EXISTS ${saltcorn.data.db.sqlsanitize(
          synchTbl
        )}_sync_info_lm_index on ${saltcorn.data.db.sqlsanitize(
          synchTbl
        )}_sync_info(last_modified);`
      );
      await saltcorn.data.db.query(
        `CREATE INDEX IF NOT EXISTS ${saltcorn.data.db.sqlsanitize(
          synchTbl
        )}_sync_info_deleted_index on ${saltcorn.data.db.sqlsanitize(
          synchTbl
        )}_sync_info(deleted);`
      );
      await saltcorn.data.db.query(
        `CREATE INDEX IF NOT EXISTS ${saltcorn.data.db.sqlsanitize(
          synchTbl
        )}_sync_info_ml_index on ${saltcorn.data.db.sqlsanitize(
          synchTbl
        )}_sync_info(modified_local);`
      );
    }
  }
}

export async function tablesUptodate(createdAt, historyFile) {
  const { updated_at } = await read_new(historyFile, "DATA");
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
    !(await fileExists_new(`${cordova.file.dataDirectory}${historyFile}`)) ||
    !(await tablesUptodate(createdAt, historyFile))
  );
}

export async function updateDb(tablesJSON) {
  await updateScTables(tablesJSON);
  await saltcorn.data.state.getState().refresh_tables();
  await updateUserDefinedTables();
  await writeJSON_new(historyFile, "DATA", {
    updated_at: new Date().valueOf(),
  });
}

export async function getTableIds(tableNames) {
  return (await saltcorn.data.models.Table.find())
    .filter((table) => tableNames.indexOf(table.name) > -1)
    .map((table) => table.id);
}

export async function createJwtTable() {
  await saltcorn.data.db.query(`CREATE TABLE IF NOT EXISTS ${jwtTableName} (
    jwt VARCHAR(500)
  )`);
}
