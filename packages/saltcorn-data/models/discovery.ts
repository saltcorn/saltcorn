/**
 * DB Tables discovery to Saltcorn tables.
 * @category saltcorn-data
 * @module models/discovery
 * @subcategory models
 */

import { Row, sqlsanitize } from "@saltcorn/db-common/internal";
import { TablePack } from "@saltcorn/types/model-abstracts/abstract_table";
import { FieldCfg } from "@saltcorn/types/model-abstracts/abstract_field";
import db from "../db";
import state from "../db/state";
const { getState } = state;
import Field from "./field";
import Table from "./table";
import utils from "../utils";
const { asyncMap } = utils;

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
  const { rows } = await dbModule.query(
    "select * from information_schema.tables where table_schema=$1 order by table_name",
    [schema]
  );
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
  const { rows } = await db.query(
    "select * from information_schema.views where table_schema=$1",
    [schema]
  );
  return rows;
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
    smallint: "Integer",
    bigint: "Integer",
    numeric: "Float", // required pres
    decimal: "Float", // required pres
    character: "String", // char - if length is not defined is 1 else length needs to be defined
    "character varying": "String", // varchar  - this type can have length
    varchar: "String",
    date: "Date",
    timestamp: "Date",
    "timestamp without time zone": "Date",
    // todo discovery "time interval" : "Date"?
  }[sql_name.toLowerCase()];
  if (fixed) return fixed;
  const state = getState();
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
  const type = findType(c.data_type);
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
  const state = getState();
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
    const { rows } = await dbModule.query(
      "select * from information_schema.columns where table_schema=$1 and table_name=$2",
      [schema, tnm]
    );
    // TBD add logic about column length, scale, etc
    //console.log(rows);

    const fields = (await asyncMap(rows, make_field)).filter(
      (f: FieldCfg) => f?.type
    );

    // try to find column name for primary key of table
    const pkq = await dbModule.query(
      `SELECT c.column_name, c.column_default
      FROM information_schema.table_constraints tc 
      JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name) 
      JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
        AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE constraint_type = 'PRIMARY KEY' and tc.table_schema=$1 and tc.table_name = $2;`,
      [schema, tnm]
    );
    // set primary_key and unique attributes for column
    pkq.rows.forEach(
      ({
        column_name,
        column_default,
      }: {
        column_name: string;
        column_default: string;
      }) => {
        const field = fields.find((f: FieldCfg) => f.name === column_name);
        field.primary_key = true;
        field.is_unique = true;
        if (!column_default) field.attributes = { NonSerial: true };
      }
    );
    // try to find foreign keys
    const fkq = await dbModule.query(
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
    await require("../db/state").getState().refresh_tables(true);
};
export = {
  discoverable_tables,
  discover_tables,
  implement_discovery,
  get_existing_views,
  findType,
};
