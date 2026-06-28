const js = async () => {
  const db = require("@saltcorn/data/db");
  if (db.isSQLite) return;

  const schema = db.getTenantSchemaPrefix();
  const { rows } = await db.query(
    `SELECT name FROM ${schema}"_sc_tables" WHERE has_sync_info = true`
  );
  for (const { name } of rows) {
    const syncTable = `${schema}"${db.sqlsanitize(name)}_sync_info"`;
    await db.query(
      `ALTER TABLE ${syncTable} ADD COLUMN IF NOT EXISTS owner_id integer`
    );
    await db.query(
      `ALTER TABLE ${syncTable} ADD COLUMN IF NOT EXISTS owner_fields jsonb`
    );
  }
};

module.exports = { js };
