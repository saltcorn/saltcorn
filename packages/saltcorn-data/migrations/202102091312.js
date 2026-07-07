const sql = "alter table _sc_fields add column primary_key boolean;";
const js = async () => {
  const Table = require("@saltcorn/data/models/table");
  const db = require("@saltcorn/data/db");
  const tables = await Table.find({});
  for (const t of tables) {
    try {
      await db.insert(
        "_sc_fields",
        {
          table_id: t.id,
          name: "id",
          label: "ID",
          type: "Integer",
          attributes: {},
          required: true,
          is_unique: true,
          primary_key: true,
        },
        { noid: true }
      );
    } catch (e) {
      console.error(e);
    }
  }
};
module.exports = { sql, js };
