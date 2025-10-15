const js = async () => {
  if (db.isSQLite) return;
  const Field = require("../models/field");
  const Table = require("../models/table");

  const db = require("../db");
  const schema = db.getTenantSchemaPrefix();

  const dateFields = await Field.find({ type: "Date" });
  for (const field of dateFields) {
    if (field.attributes.day_only) {
      const table = Table.findOne({ id: field.table_id });
      try {
        await db.query(
          `alter table ${schema}"${db.sqlsanitize(
            table.name
          )}" alter column "${field.name}" TYPE date;`
        );
      } catch (e) {
        console.error(e);
      }
    }
  }
};
module.exports = { js };
