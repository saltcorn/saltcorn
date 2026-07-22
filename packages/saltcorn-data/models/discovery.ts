/**
 * DB Tables discovery to Saltcorn tables.
 * @category saltcorn-data
 * @module models/discovery
 * @subcategory models
 */

import * as nsState from "../db/state.js";
import { Row, sqlsanitize } from "@saltcorn/db-common/internal";
import { TablePack } from "@saltcorn/types/model-abstracts/abstract_table";
import { FieldCfg } from "@saltcorn/types/model-abstracts/abstract_field";
import db from "../db/index.js";
import { getState } from "../db/state.js";
import Field from "./field.js";
import Table from "./table.js";
import { asyncMap } from "../utils.js";

const lcKeys = (rows: Row[]): Row[] =>
  db.driverName === "mysql"
    ? rows.map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])
        )
      )
    : rows;

// create table discmetable(id serial primary key, name text, age integer not null); ALTER TABLE discmetable OWNER TO tomn;
/**
 * List of discoverable tables.
 * Returns all tables that can be imported to Saltcorn from current tenant database schema.
 * The tables with name started with "_sc_" and tables imported to Saltcorn are ignored.
 * @param {string} schema0 - current tenant db schema
 * @returns {Promise<object[]>} all tables that can be imported to Saltcorn from current tenant database schema
 */
const discoverable_tables = async (
  schema0?: string,
  allTables: boolean = false,
  dbModule: typeof db = db
): Promise<Row[]> => {
  const schema = schema0 || dbModule.getTenantSchema();
  const { where, values } = dbModule.mkWhere({ table_schema: schema });
  const { rows: rows0 } = await dbModule.query(
    `select * from information_schema.tables ${where} order by table_name`,
    values
  );
  const rows = lcKeys(rows0);
  const myTables = await Table.find({});
  const myTableNames = myTables.map((t) => sqlsanitize(t.name));
  const myTableHistoryNames = myTables
    .filter((t) => t.versioned)
    .map((t) => `${sqlsanitize(t.name)}__history`);
  if (allTables) return rows;
  const discoverable = rows.filter(
    (t: Row) =>
      !(
        myTableNames.includes(t.table_name) ||
        myTableHistoryNames.includes(t.table_name) ||
        t.table_name.startsWith("_sc_")
      )
  );
  return discoverable;
};
/**
 * List all views in current  tenant db schema
 * @param {string} schema0 - current tenant db schema
 * @returns {Promise<object[]>} Return list of views
 */
const get_existing_views = async (schema0?: string): Promise<Row[]> => {
  const schema = schema0 || db.getTenantSchema();
  const { where, values } = db.mkWhere({ table_schema: schema });
  const { rows } = await db.query(
    `select * from information_schema.views ${where}`,
    values
  );
  return lcKeys(rows);
};
/**
 * Mapping SQL Type to Saltcorn type (For Discovery)
 * @param {string} sql_name - SQL type name
 * @returns {string|void} return Saltcorn type
 */
const findType = (sql_name: string): string | undefined => {
  const fixed: string | undefined = {
    // todo more types
    // todo attributes: length, pres
    integer: "Integer",
    int: "Integer", // mysql
    mediumint: "Integer", // mysql
    smallint: "Integer",
    bigint: "Integer",
    numeric: "Float", // required pres
    decimal: "Float", // required pres
    double: "Float", // mysql
    "double precision": "Float",
    real: "Float",
    character: "String", // char - if length is not defined is 1 else length needs to be defined
    "character varying": "String", // varchar  - this type can have length
    varchar: "String",
    citext: "String",
    text: "String",
    date: "Date",
    timestamp: "Date",
    datetime: "Date", // mysql
    "timestamp without time zone": "Date",
    "timestamp with time zone": "Date",
    timestamptz: "Date",
    boolean: "Bool",
    tinyint: "Bool", // mysql stores Bool as tinyint(1)
    // todo discovery "time interval" : "Date"?
  }[sql_name.toLowerCase()];
  if (fixed) return fixed;
  const state = getState()!;
  if (!state) {
    throw new Error("unable to get state");
  }
  for (const [k, v] of Object.entries(state.types)) {
    if (
      typeof v.sql_name === "string" &&
      v.sql_name.toLowerCase() === sql_name.toLowerCase()
    )
      return k;
  }
};

const make_field = async (c: Row): Promise<FieldCfg | undefined> => {
  const type =
    c.udt_name === "citext" || (c.data_type === "USER-DEFINED" && c.udt_name)
      ? findType(c.udt_name)
      : findType(c.data_type);
  const basicField = {
    name: c.column_name,
    label: c.column_name,
    type,
    required: c.is_nullable === "NO",
  };
  if (type)
    return {
      ...basicField,
      type,
    };
  const state = getState()!;
  if (!state) {
    throw new Error("unable to get state");
  }
  for (const [k, v] of Object.entries(state.types)) {
    if (v.discovery_match) {
      const match = await v.discovery_match(c);
      if (match) return { ...basicField, ...match };
    }
  }
};

/**
 * Discover tables definitions
 * @param {string[]} tableNames - list of table names
 * @param {string} schema0 - db schema
 * @returns {Promise<object>}
 */
const discover_tables = async (
  tableNames: string[],
  schema0?: string,
  dbModule: typeof db = db
): Promise<{ tables: Array<TablePack> }> => {
  const schema = schema0 || dbModule.getTenantSchema();
  const packTables = new Array<TablePack>();

  for (const tnm of tableNames) {
    const { rows: rows0 } = await dbModule.query(
      `select * from information_schema.columns where table_schema=$1 and table_name=$2${
        db.driverName === "mysql" ? " order by ordinal_position" : ""
      }`,
      [schema, tnm]
    );
    const rows = lcKeys(rows0);
    // TBD add logic about column length, scale, etc
    //console.log(rows);

    const fields = (await asyncMap(rows, make_field)).filter(
      (f: FieldCfg) => f?.type
    );

    // try to find column name for primary key of table. MySQL has no
    // information_schema.constraint_column_usage, so use key_column_usage
    // (its pk constraint is always named 'PRIMARY').
    const pkq = await dbModule.query(
      db.driverName === "mysql"
        ? `SELECT k.column_name, c.column_default, c.extra
           FROM information_schema.key_column_usage k
           JOIN information_schema.columns c
             ON c.table_schema = k.table_schema
            AND c.table_name = k.table_name
            AND c.column_name = k.column_name
           WHERE k.constraint_name = 'PRIMARY'
             AND k.table_schema = $1 AND k.table_name = $2;`
        : `SELECT c.column_name, c.column_default
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
      JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
        AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE constraint_type = 'PRIMARY KEY' and tc.table_schema=$1 and tc.table_name = $2;`,
      [schema, tnm]
    );
    // set primary_key and unique attributes for column
    (lcKeys(pkq.rows) as any[]).forEach(
      ({
        column_name,
        column_default,
        extra,
      }: {
        column_name: string;
        column_default: string;
        extra?: string;
      }) => {
        const field = fields.find((f: FieldCfg) => f.name === column_name);
        field.primary_key = true;
        field.is_unique = true;
        // MySQL AUTO_INCREMENT pks report a null default but are serial, not
        // NonSerial (its serial-ness shows in `extra`, not `column_default`).
        const isAutoInc = (extra || "").toLowerCase().includes("auto_increment");
        if (!column_default && !isAutoInc)
          field.attributes = { NonSerial: true };
      }
    );
    // try to find foreign keys. MySQL exposes the referenced table/column
    // directly on key_column_usage (no constraint_column_usage needed).
    const fkq = await dbModule.query(
      db.driverName === "mysql"
        ? `SELECT
             table_schema,
             constraint_name,
             table_name,
             column_name,
             referenced_table_schema AS foreign_table_schema,
             referenced_table_name AS foreign_table_name,
             referenced_column_name AS foreign_column_name
           FROM information_schema.key_column_usage
           WHERE referenced_table_name IS NOT NULL
             AND table_schema = $1 AND table_name = $2;`
        : `SELECT
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
    (lcKeys(fkq.rows) as any[]).forEach(
      ({
        column_name,
        foreign_table_name,
        foreign_column_name,
      }: {
        column_name: string;
        foreign_table_name: string;
        foreign_column_name: string;
      }) => {
        const field = fields.find((f: Field) => f.name === column_name);
        field.type = "Key";
        field.reftable_name = foreign_table_name;
        field.refname = foreign_column_name;
      }
    );

    packTables.push({ name: tnm, fields, min_role_read: 1, min_role_write: 1 });
  }
  packTables.forEach((t) => {
    t.fields &&
      t.fields.forEach((f: FieldCfg) => {
        if (f.type === "Key") {
          // check saltcorn tables for ref table
          const reftablesc = Table.findOne({ name: f.reftable_name });
          if (reftablesc) {
            if (!reftablesc.fields)
              throw new Error(`The table '${f.reftable_name}' has no fields`);

            // get ref pk type
            const refpksc = reftablesc.fields.find(
              (rtf: FieldCfg) => rtf.primary_key === true
            );
            if (!refpksc || !refpksc.type)
              throw new Error(`The '${f.reftable_name}' has no primary key`);

            f.reftype = refpksc.type =
              typeof refpksc.type !== "string"
                ? (f.reftype = refpksc.type.name)
                : (f.reftype = refpksc.type);
          } else {
            // check importing tables
            const reftable = packTables.find(
              (reft) => reft.name === f.reftable_name
            );
            if (!reftable)
              throw new Error(`Unable to find table '${f.reftable_name}'`);
            if (!reftable.fields)
              throw new Error(`The table '${f.reftable_name}' has no fields`);
            const refpk = reftable.fields.find(
              (rtf: FieldCfg) => rtf.primary_key
            );
            if (!refpk)
              throw new Error(
                `The table '${f.reftable_name}' has no primary key`
              );
            f.reftype = refpk.type;
          }
        }
      });
  });
  return { tables: packTables };
};
/**
 * Add discovered tables to Saltcorn
 * @param {object} pack - table definition
 * @returns {Promise<void>}
 */
const implement_discovery = async (pack: {
  tables: Array<TablePack>;
}): Promise<void> => {
  for (const table of pack.tables) {
    const { fields, ...tblRow } = table;
    table.id = await db.insert("_sc_tables", tblRow);
  }
  for (const table of pack.tables) {
    if (table.fields) {
      for (const field of table.fields) {
        await db.insert("_sc_fields", { ...field, table_id: table.id });
      }
    }
  }
  // refresh Saltcorn table list (in memory)
  if (!db.getRequestContext()?.client)
    await nsState.getState()!.refresh_tables(true);
};
/**
 * Reconcile Saltcorn field metadata against physical DB columns.
 * Returns a report of matches, ghosts (in Saltcorn but not in DB),
 * and orphans (in DB but not in Saltcorn).
 * This is a read-only operation — nothing is modified.
 * @param table - Saltcorn Table instance
 * @returns {Promise<ReconcileResult>} reconciliation report
 */
const reconcile_table = async (
  table: Table
): Promise<{
  table_name: string;
  fields: Array<{
    name: string;
    type?: string;
    status: "match" | "ghost" | "orphan";
  }>;
  ghost_count: number;
  orphan_count: number;
  match_count: number;
}> => {
  const schema = db.getTenantSchema();
  const schemaPrefix = db.getTenantSchemaPrefix();
  const scFields = table.getFields();

  // Get physical column names from the DB (engine-specific introspection)
  let physicalRows: Row[];
  if (db.driverName === "sqlite") {
    const { rows } = await db.query(
      `PRAGMA table_info("${sqlsanitize(table.name)}")`
    );
    physicalRows = rows.map((r: Row) => ({ column_name: r.name }));
  } else {
    const { rows } = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2",
      [schema, table.name]
    );
    physicalRows = lcKeys(rows);
  }
  const physicalNames = new Set(physicalRows.map((r: Row) => r.column_name));
  const scNames = new Set(scFields.map((f: Field) => f.name));

  const fields: Array<{
    name: string;
    type?: string;
    status: "match" | "ghost" | "orphan";
  }> = [];

  // Saltcorn fields → match or ghost
  for (const f of scFields) {
    const isTransient = f.calculated && !f.stored;
    const fieldType = typeof f.type === "string" ? f.type : f.type?.name;
    if (physicalNames.has(f.name) || isTransient) {
      fields.push({ name: f.name, type: fieldType, status: "match" });
    } else {
      fields.push({ name: f.name, type: fieldType, status: "ghost" });
    }
  }

  // DB columns not in Saltcorn → orphan
  for (const colName of physicalNames) {
    if (!scNames.has(colName)) {
      // Try to determine the SQL type for display (engine-specific introspection)
      let sqlType: string | undefined;
      if (db.driverName !== "sqlite") {
        const { rows } = await db.query(
          "SELECT data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3",
          [schema, table.name, colName]
        );
        const lcr = lcKeys(rows);
        if (lcr.length) sqlType = lcr[0].data_type;
      }
      fields.push({ name: colName, type: sqlType, status: "orphan" });
    }
  }

  return {
    table_name: table.name,
    fields,
    ghost_count: fields.filter((f) => f.status === "ghost").length,
    orphan_count: fields.filter((f) => f.status === "orphan").length,
    match_count: fields.filter((f) => f.status === "match").length,
  };
};

export {
  discoverable_tables,
  discover_tables,
  implement_discovery,
  get_existing_views,
  findType,
  make_field,
  reconcile_table,
};
