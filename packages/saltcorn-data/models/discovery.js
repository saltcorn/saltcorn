/**
 * DB Tables discovery to Saltcorn tables.
 * @type {{changeConnection?: ((function(*): Promise<void>)|(function(*=): Promise<void>)), select?: ((function(*=, *=, *=): Promise<*>)|(function(*=, *=, *=): Promise<*>)), runWithTenant: ((function(*=, *=): (*))|(function(*, *): *)), set_sql_logging?: (function(*=): void), insert?: ((function(*=, *=, *=): Promise<undefined|*>)|(function(*=, *=, *=): Promise<undefined|*>)), update?: ((function(*=, *=, *=): Promise<void>)|(function(*=, *=, *=, *=): Promise<void>)), sql_log?: (function(*=, *=): void), deleteWhere?: ((function(*=, *=): Promise<void>)|(function(*=, *=): Promise<*>)), isSQLite: *, selectMaybeOne?: ((function(*=, *=): Promise<null|*>)|(function(*=, *=): Promise<null|*>)), close?: (function(): Promise<void>), drop_unique_constraint?: (function(*=, *): Promise<void>), enable_multi_tenant: (function()), getVersion?: ((function(): Promise<*>)|(function(*=): Promise<*>)), add_unique_constraint?: (function(*=, *): Promise<void>), getTenantSchema: ((function(): *)|(function(): *)), is_it_multi_tenant: ((function(): boolean)|(function(): boolean)), sqliteDatabase?: *, drop_reset_schema?: ((function(): Promise<void>)|(function(*): Promise<void>)), query?: ((function(*=, *=): Promise<unknown>)|(function(*=, *=): *)), count?: ((function(*=, *=): Promise<number>)|(function(*=, *=): Promise<number>)), pool?: *, connectObj: {sc_version: *, connectionString: string | undefined, git_commit: *, version_tag: *}|{sc_version: *, git_commit: *, version_tag: *}|boolean, sqlsanitize: *|(function(...[*]=): *), getClient?: (function(): Promise<*>), reset_sequence?: (function(*=): Promise<void>), copyFrom?: (function(*=, *=, *, *): Promise<void>), mkWhere: function(*=): {values: *, where: string|string}, selectOne?: ((function(*=, *=): Promise<*|undefined>)|(function(*=, *=): Promise<*|undefined>)), getTenantSchemaPrefix: function(): string|string}|{sqlsanitize?: *|(function(...[*]=): *), connectObj?: {sc_version: *, connectionString: string | undefined, git_commit: *, version_tag: *}|{sc_version: *, git_commit: *, version_tag: *}|boolean, isSQLite?: *, mkWhere?: function(*=): {values: *, where: string|string}, getTenantSchemaPrefix?: function(): string|string}}
 */
const db = require("../db");
const { getState } = require("../db/state");
const { available_languages } = require("./config");
const Table = require("./table");

// create table discmetable(id serial primary key, name text, age integer not null); ALTER TABLE discmetable OWNER TO tomn;
/**
 * List of discoverable tables.
 * Returns all tables that can be imported to Saltcorn from current tenant database schema.
 * The tables with name started with "_sc_" and tables imported to Saltcorn are ignored.
 * @param schema0 - current tenant db schema
 * @returns {Promise<*>} all tables that can be imported to Saltcorn from current tenant database schema
 */
const discoverable_tables = async (schema0) => {
  const schema = schema0 || db.getTenantSchema();
  const {
    rows,
  } = await db.query(
    "select * from information_schema.tables where table_schema=$1 order by table_name",
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
/**
 * List all views in current  tenant db schema
 * @param schema0 - current tenant db schema
 * @returns {Promise<*>} Return list of views
 */
const get_existing_views = async (schema0) => {
  const schema = schema0 || db.getTenantSchema();
  const {
    rows,
  } = await db.query(
    "select * from information_schema.views where table_schema=$1",
    [schema]
  );
  return rows;
};
/**
 * Mapping SQL Type to Saltcorn type
 * @param sql_name - SQL type name
 * @returns {string|*} return Saltcorn type
 */
const findType = (sql_name) => {
  const fixed = {
    integer: "Integer",
    smallint: "Integer",
    bigint: "Integer",
    numeric: "Float", // required pres
    character: "String", // char - if length is not defined is 1 else length needs to be defined
    "character varying": "String", // varchar  - this type can have length
    //varchar: "String",
    date: "Date"
    // TBD Implement time type in Saltcorn
    // "time without time zone": "Date",
    // TBD Implement timestamp type in Saltcorn
    // "timestamp without time zone": "Date",
    // TBD Implement time interval in Saltcorn
    // interval: "Date"
  }[sql_name];
  if (fixed) return fixed;
  const t = Object.entries(getState().types).find(
    ([k, v]) => v.sql_name === sql_name
  );
  if (t) {
    return t[0];
  }
};
/**
 * Discover tables definitions
 * @param tableNames - list of table names
 * @param schema0 - db schema
 * @returns {Promise<{tables: *[]}>}
 */
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
    // TBD add logic about column length, scale, etc
    const fields = rows
      .map((c) => ({
        name: c.column_name,
        label: c.column_name,
        type: findType(c.data_type),
        required: c.is_nullable === "NO",
      }))
      .filter((f) => f.type);

    // try to find column name for primary key of table
    const pkq = await db.query(
      `SELECT c.column_name
      FROM information_schema.table_constraints tc 
      JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name) 
      JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
        AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE constraint_type = 'PRIMARY KEY' and tc.table_schema=$1 and tc.table_name = $2;`,
      [schema, tnm]
    );
    // set primary_key and unique attributes for column
    pkq.rows.forEach(({ column_name }) => {
      const field = fields.find((f) => f.name === column_name);
      field.primary_key = true;
      field.is_unique = true;
    });
    // try to find foreign keys
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
    // construct foreign key relations
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
/**
 * Add discovered tables to Saltcorn
 * @param pack - table definition
 * @returns {Promise<void>}
 */
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
  // refresh Saltcorn table list (in memory)
  await require("../db/state").getState().refresh_tables();

};
module.exports = {
  discoverable_tables,
  discover_tables,
  implement_discovery,
  get_existing_views,
};
