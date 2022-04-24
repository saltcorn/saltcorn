/**
 * DB Tables discovery to Saltcorn tables.
 * @category saltcorn-data
 * @module models/discovery
 * @subcategory models
 */

import { Row } from "@saltcorn/db-common/internal";
import { PluginType } from "@saltcorn/types/base_types";
import { Type } from "@saltcorn/types/common_types";
import { TablePack } from "@saltcorn/types/model-abstracts/abstract_table";
import { FieldCfg } from "@saltcorn/types/model-abstracts/abstract_field";
import db from "../db";
import state from "../db/state";
const { getState } = state;
import Field from "./field";
import Table from "./table";

// create table discmetable(id serial primary key, name text, age integer not null); ALTER TABLE discmetable OWNER TO tomn;
/**
 * List of discoverable tables.
 * Returns all tables that can be imported to Saltcorn from current tenant database schema.
 * The tables with name started with "_sc_" and tables imported to Saltcorn are ignored.
 * @param {string} schema0 - current tenant db schema
 * @returns {Promise<object[]>} all tables that can be imported to Saltcorn from current tenant database schema
 */
const discoverable_tables = async (schema0?: string): Promise<Row[]> => {
  const schema = schema0 || db.getTenantSchema();
  const { rows } = await db.query(
    "select * from information_schema.tables where table_schema=$1 order by table_name",
    [schema]
  );
  const myTables = await Table.find({});
  const myTableNames = myTables.map((t) => t.name);
  const discoverable = rows.filter(
    (t: Row) =>
      !(myTableNames.includes(t.table_name) || t.table_name.startsWith("_sc_"))
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
 * Mapping SQL Type to Saltcorn type
 * @param {string} sql_name - SQL type name
 * @returns {string|void} return Saltcorn type
 */
const findType = (sql_name: string): any => {
  const fixed: string | undefined = {
    integer: "Integer",
    smallint: "Integer",
    bigint: "Integer",
    numeric: "Float", // required pres
    character: "String", // char - if length is not defined is 1 else length needs to be defined
    "character varying": "String", // varchar  - this type can have length
    //varchar: "String",
    date: "Date",
    // TBD Implement time type in Saltcorn
    // "time without time zone": "Date",
    // TBD Implement timestamp type in Saltcorn
    // "timestamp without time zone": "Date",
    // TBD Implement time interval in Saltcorn
    // interval: "Date"
  }[sql_name];
  if (fixed) return fixed;
  const state = getState();
  if (!state) {
    throw new Error("unable to get state");
  }
  const t = Object.entries(state.types).find(
    ([k, v]: [k: string, v: any]) => v.sql_name === sql_name
  );
  if (t) {
    return t[0];
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
  schema0?: string
): Promise<{ tables: Array<TablePack> }> => {
  const schema = schema0 || db.getTenantSchema();
  const packTables = new Array<TablePack>();

  for (const tnm of tableNames) {
    const { rows } = await db.query(
      "select * from information_schema.columns where table_schema=$1 and table_name=$2",
      [schema, tnm]
    );
    // TBD add logic about column length, scale, etc
    const fields = rows
      .map((c: Row) => ({
        name: c.column_name,
        label: c.column_name,
        type: findType(c.data_type),
        required: c.is_nullable === "NO",
      }))
      .filter((f: FieldCfg) => f.type);

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
    pkq.rows.forEach(({ column_name }: { column_name: string }) => {
      const field = fields.find((f: FieldCfg) => f.name === column_name);
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
    const id = await db.insert("_sc_tables", tblRow);
    table.id = id;
  }
  for (const table of pack.tables) {
    if (table.fields) {
      for (const field of table.fields) {
        await db.insert("_sc_fields", { ...field, table_id: table.id });
      }
    }
  }
  // refresh Saltcorn table list (in memory)
  await require("../db/state").getState().refresh_tables();
};
export = {
  discoverable_tables,
  discover_tables,
  implement_discovery,
  get_existing_views,
};
