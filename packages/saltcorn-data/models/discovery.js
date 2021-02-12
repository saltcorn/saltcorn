const db = require("../db");
const { getState } = require("../db/state");
const { available_languages } = require("./config");
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
    const fields = rows
      .map((c) => ({
        name: c.column_name,
        label: c.column_name,
        type: findType(c.data_type),
        required: c.is_nullable === "NO",
      }))
      .filter((f) => f.type);

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
      const field = fields.find((f) => f.name === column_name);
      field.primary_key = true;
      field.is_unique = true;
    });
    const fkq = await db.query(
      `SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
  FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' and tc.table_schema=$1 AND tc.table_name=$2;`,
      [schema, tnm]
    );
    fkq.rows.forEach(
      ({ column_name, foreign_table_name, foreign_column_name }) => {
        const field = fields.find((f) => f.name === column_name);
        field.type = "Key";
        field.reftable_name = foreign_table_name;
        field.refname = foreign_column_name;
      }
    );

    packTables.push({ name: tnm, fields, min_role_read: 1, min_role_write: 1 });
  }
  packTables.forEach((t) => {
    t.fields.forEach((f) => {
      if (f.type === "Key") {
        const reftable = packTables.find(
          (reft) => reft.name === f.reftable_name
        );
        const refpk = reftable.fields.find((rtf) => rtf.primary_key);
        f.reftype = refpk.type;
      }
    });
  });
  return { tables: packTables };
};

const implement_discovery = async (pack) => {
  for (const table of pack.tables) {
    const { fields, ...tblRow } = table;
    const id = await db.insert("_sc_tables", tblRow);
    table.id = id;
  }
  for (const table of pack.tables) {
    for (const field of table.fields) {
      await db.insert("_sc_fields", { ...field, table_id: table.id });
    }
  }
};
module.exports = { discoverable_tables, discover_tables, implement_discovery };
