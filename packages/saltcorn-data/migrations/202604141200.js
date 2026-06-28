const db = require("@saltcorn/data/db");

// Change ref column from integer to text to support UUID primary keys.
// Uses db.sqlsanitize so table names with whitespace or special chars are safe.
const js = async () => {
  const schema = db.getTenantSchemaPrefix();
  const tables = await db.select("_sc_tables", { has_sync_info: true });
  for (const { name } of tables) {
    await db.query(
      `ALTER TABLE ${schema}"${db.sqlsanitize(name)}_sync_info"
       ALTER COLUMN ref TYPE text USING ref::text`
    );
  }
};

module.exports = { js };
