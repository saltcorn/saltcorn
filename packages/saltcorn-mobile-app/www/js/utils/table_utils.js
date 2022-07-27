import { fileExists, readJSON, writeJSON } from "./file_helpers.js";

const historyFile = "update_history";

async function updateScTables(tablesJSON, skipScPlugins = true) {
  saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
  // TODO drop tables with the same name and a new id
  // could mean they were deleted and re-created
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

async function updateUserDefinedTables() {
  const existingTables = await saltcorn.data.db.listUserDefinedTables();
  const tables = await saltcorn.data.models.Table.find();
  for (const table of tables) {
    if (
      table.name !== "users" &&
      !existingTables.find((row) => row.name === table.name)
    ) {
      // CREATE TABLE without inserting into _sc_tables
      await saltcorn.data.models.Table.create(table.name, {}, table.id);
    }
    const existingFields = (
      await saltcorn.data.db.query(`PRAGMA table_info('${table.name}')`)
    ).rows.map((row) => row.name);
    for (const field of await table.getFields()) {
      if (existingFields.indexOf(field.name) < 0) {
        // field is new
        await saltcorn.data.models.Field.create(field, false, field.id);
      }
    }
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
  await updateUserDefinedTables();
  await writeJSON(historyFile, cordova.file.dataDirectory, {
    updated_at: new Date(),
  });
}

export async function getTableIds(tableNames) {
  return (await saltcorn.data.models.Table.find())
    .filter((table) => tableNames.indexOf(table.name) > -1)
    .map((table) => table.id);
}
