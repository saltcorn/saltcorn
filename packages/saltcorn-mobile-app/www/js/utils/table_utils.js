import { fileExists, readJSON, writeJSON } from "./file_helpers.js";

async function updateTables(tablesJSON) {
  saltcorn.data.db.query("PRAGMA foreign_keys = OFF;");
  for (const { table, rows } of tablesJSON.sc_tables) {
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
  const tablesJSON = await readJSON(
    "tables.json",
    `${cordova.file.applicationDirectory}${"www"}`
  );
  const historyFile = "update_history";
  if (
    !(await fileExists(`${cordova.file.dataDirectory}${historyFile}`)) ||
    !(await tablesUptodate(tablesJSON, historyFile))
  ) {
    console.log("updating tables");
    await updateTables(tablesJSON);
    await writeJSON(historyFile, cordova.file.dataDirectory, {
      updated_at: new Date(),
    });
  }
}
