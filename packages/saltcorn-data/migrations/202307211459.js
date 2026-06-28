const sql = "";
const js = async () => {
  const Table = require("@saltcorn/data/models/table");
  const db = require("@saltcorn/data/db");
  const schema = db.getTenantSchemaPrefix();

  const tables = await Table.find({});
  for (const table of tables) {
    if (table.versioned) {
      try {
        await db.query(
          `alter table ${schema}"${db.sqlsanitize(
            table.name
          )}__history" add column _restore_of_version integer;`
        );
      } catch (e) {
        console.error(e);
      }
    }
  }
};
module.exports = { js };
