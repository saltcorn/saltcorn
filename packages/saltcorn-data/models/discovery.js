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

const findType = (sql_name) => {
  const fixed = { integer: "Integer" }[sql_name];
  if (fixed) return fixed;
  const t = Object.entries(getState().types).find(
    ([k, v]) => v.sql_name === sql_name
  );
  if (t) {
    return t[0];
  }
};
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
    //console.log(rows);
    const fields = rows
      .map((c) => ({
        name: c.column_name,
        label: c.column_name,
        type: findType(c.data_type),
        required: c.is_nullable === "NO",
      }))
      .filter((f) => f.type);
    packTables.push({ name: tnm, fields });
    const pkq = await db.query(
      `SELECT c.column_name
      FROM information_schema.table_constraints tc 
      JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name) 
      JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
        AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE constraint_type = 'PRIMARY KEY' and tc.table_schema=$1 and tc.table_name = $2;`,
      [schema, tnm]
    );
    pkq.rows.forEach(({ column_name }) => {
      fields.find((f) => f.name === column_name).primary_key = true;
    });
    return { tables: packTables };
  }
};
module.exports = { discoverable_tables, discover_tables };
