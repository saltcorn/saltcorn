const js = async () => {
  const db = require("../db");
  if (db.isSQLite) return;
  const Field = require("../models/field");
  const Table = require("../models/table");
  const { getState } = require("../db/state");

  const state = getState();
  await state?.refresh_tables(false);

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
