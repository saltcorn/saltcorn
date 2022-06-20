import { fileExists, readJSON, writeJSON } from "./file_helpers.js";

const historyFile = "update_history";

async function updateScTables(tablesJSON, skipScPlugins = true) {
  saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
  for (const { table, rows } of tablesJSON.sc_tables) {
    if (skipScPlugins && table === "_sc_plugins") continue;
    await saltcorn.data.db.deleteWhere(table);
    for (const row of rows) {
      await saltcorn.data.db.insert(table, row);
    }
  }
  saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
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

async function handleUserDefinedTables() {
  const tables = await saltcorn.data.models.Table.find();
  const existingTables = await saltcorn.data.db.listUserDefinedTables();
  const skipIds = [1]; // skip user table
  for (const table of tables) {
    if (existingTables.find((row) => row.name === table.name)) {
      skipIds.push(table.id);
    } else if (table.name !== "users") {
      // CREATE TABLE without inserting into _sc_tables
      await saltcorn.data.models.Table.create(table.name, {}, table.id);
    }
  }
  const fields = await saltcorn.data.models.Field.find();
  for (const field of fields) {
    if (skipIds.indexOf(field.table_id) < 0 && field.name !== "id")
      await saltcorn.data.models.Field.create(field, false, field.id);
  }
}

async function tablesUptodate(tables, historyFile) {
  const history = await readJSON(historyFile, cordova.file.dataDirectory);
  return tables.created_at.valueOf() < history.updated_at.valueOf();
}

export async function dbUpdateNeeded(tablesJSON) {
  return (
    !(await fileExists(`${cordova.file.dataDirectory}${historyFile}`)) ||
    !(await tablesUptodate(tablesJSON, historyFile))
  );
}

export async function updateDb(tablesJSON) {
  await updateScTables(tablesJSON);
  await saltcorn.data.state.getState().refresh_tables();
  await handleUserDefinedTables();
  await writeJSON(historyFile, cordova.file.dataDirectory, {
    updated_at: new Date(),
  });
}

export async function getTableIds(tableNames) {
  return (await saltcorn.data.models.Table.find())
    .filter((table) => tableNames.indexOf(table.name) > -1)
    .map((table) => table.id);
}
