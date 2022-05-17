import { fileExists, readJSON, writeJSON } from "./file_helpers.js";

async function updateTables(metaTablesFile) {
  saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
  for (const { table, rows } of metaTablesFile.tables) {
    await saltcorn.data.db.deleteWhere(table);
    for (const row of rows) {
      await saltcorn.data.db.insert(table, row);
    }
  }
  saltcorn.data.db.query("PRAGMA foreign_keys = ON;");
}

async function tablesUptodate(tables, historyFile) {
  const history = await readJSON(historyFile, cordova.file.dataDirectory);
  return tables.created_at.valueOf() < history.updated_at.valueOf();
}

export async function handleTables() {
  const tables = await readJSON(
    "tables.json",
    `${cordova.file.applicationDirectory}${"www"}`
  );
  const historyFile = "update_history";
  if (
    !(await fileExists(`${cordova.file.dataDirectory}${historyFile}`)) ||
    !(await tablesUptodate(tables, historyFile))
  ) {
    console.log("updating tables");
    await updateTables(tables);
    await writeJSON(historyFile, cordova.file.dataDirectory, {
      updated_at: new Date(),
    });
  }
}
