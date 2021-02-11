const db = require("../db");
const { getState } = require("../db/state");
const Table = require("./table");

// create table discmetable(id serial primary key, name text, age integer not null); ALTER TABLE discmetable OWNER TO tomn;

const discoverable_tables = async (schema0) => {
  const schema = schema0 || db.getTenantSchema();
  const {
    rows,
  } = await db.query(
    "select * from information_schema.tables where table_schema=$1",
    [schema]
  );
  const myTables = await Table.find({});
  const myTableNames = myTables.map((t) => t.name);
  const discoverable = rows.filter(
    (t) =>
      !(myTableNames.includes(t.table_name) || t.table_name.startsWith("_sc_"))
  );
  return discoverable;
};

const safeIx = (xs, ix) => (xs && xs.length && xs.length > ix ? xs[ix] : null);

const findType = (sql_name) =>
  safeIx(
    Object.entries(getState().types).find(([k, v]) => v.sql_name === sql_name),
    1
  );

const discover_tables = async (tableNames, schema0) => {
  const schema = schema0 || db.getTenantSchema();
  const packTables = [];
  for (const tnm of tableNames) {
    const {
      rows,
    } = await db.query(
      "select * from information_schema.columns where table_schema=$1 and table_name=$2",
      [schema, tnm]
    );
    console.log(rows);
    const fields = rows
      .map((c) => ({
        name: c.column_name,
        label: c.column_name,
        type: findType(c.data_type),
        required: c.is_nullable === "NO",
      }))
      .filter((f) => f.type);
    packTables.push({ name: tnm, fields });
    return { tables: packTables };
  }
};
module.exports = { discoverable_tables, discover_tables };
