const sql = "alter table _sc_fields add column primary_key boolean;";
const js = async () => {
  const Table = require("../models/table");
  const db = require("../db");
  const tables = await Table.find({});
  const schema = db.getTenantSchemaPrefix();
  for (const t of tables) {
    db.query(
      `insert into ${schema}_sc_fields(table_id, name, label, type, attributes, required, is_unique,primary_key)
          values($1,'id','ID','Integer', '{}', true, true, true)`,
      [t.id]
    );
  }
};
module.exports = { sql, js };
