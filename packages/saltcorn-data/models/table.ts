/**
 * Table Database Access Layer
 * @category saltcorn-data
 * @module models/table
 * @subcategory models
 */
import db from "../db";
import {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
  orderByIsObject,
  orderByIsOperator,
} from "@saltcorn/db-common/internal";
import type {
  Where,
  SelectOptions,
  Row,
  JoinFields,
  JoinOptions,
  AggregationOptions,
} from "@saltcorn/db-common/internal";

import Field from "./field";
import type {
  AbstractTable,
  TableCfg,
  TablePack,
} from "@saltcorn/types/model-abstracts/abstract_table";

import type {
  ForUserRequest,
  AbstractUser,
} from "@saltcorn/types/model-abstracts/abstract_user";

import type { ResultMessage, Type } from "@saltcorn/types/common_types";
import {
  instanceOfErrorMsg,
  instanceOfType,
} from "@saltcorn/types/common_types";

import Trigger from "./trigger";
import expression from "./expression";
const {
  apply_calculated_fields,
  apply_calculated_fields_stored,
  recalculate_for_stored,
  get_expression_function,
  eval_expression,
  freeVariables,
  add_free_variables_to_joinfields,
  removeComments,
} = expression;

import type TableConstraint from "./table_constraints";

import csvtojson from "csvtojson";
import moment from "moment";
import { createReadStream } from "fs";
import { stat, readFile } from "fs/promises";
//import { num_between } from "@saltcorn/types/generators";
//import { devNull } from "os";
import utils from "../utils";
const {
  prefixFieldsInWhere,
  InvalidConfiguration,
  InvalidAdminAction,
  satisfies,
  structuredClone,
  getLines,
  mergeIntoWhere,
  stringToJSON,
  isNode,
  apply,
  applyAsync,
  asyncMap,
} = utils;
import tags from "@saltcorn/markup/tags";
const { text } = tags;

import type { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import type {
  JoinFieldOption,
  RelationOption,
} from "@saltcorn/types/base_types";
import { get_formula_examples } from "./internal/table_helper";
import { getAggAndField, process_aggregations } from "./internal/query";

/**
 * Transponce Objects
 * TODO more detailed explanation
 * TODO refactor - move to object util module?
 * @param objs
 * @returns {object}
 */
const transposeObjects = (objs: any[]): any => {
  const keys = new Set<string>();
  for (const o of objs) {
    Object.keys(o).forEach((k) => keys.add(k));
  }
  const res: any = {};
  keys.forEach((k: string) => {
    res[k] = [];
  });
  for (const o of objs) {
    keys.forEach((k: string) => {
      res[k].push(o[k]);
    });
  }
  return res;
};
// todo support also other date formats https://momentjs.com/docs/
const dateFormats = [moment.ISO_8601];
// todo refactor - move to separated data utils module?
/**
 * Is Valid Date of format moment.ISO_8601,
 * example 2010-01-01T05:06:07
 *
 * @param date
 * @returns {boolean}
 */
const isDate = function (date: Date): boolean {
  return moment(date, dateFormats, true).isValid();
};

/**
 * A class representing database tables and their properties.
 *
 * Use this to create or delete tables and their properties, or to query
 * or change table rows.
 *
 * To query, update, insert or delete rows in an existing table, first you
 * should find the table object with {@link Table.findOne}.
 *
 * @example
 * ```
 * Table.findOne({name: "Customers"}) // find the table with name "Customers"
 * Table.findOne("Customers") // find the table with name "Customers" (shortcut)
 * Table.findOne({ id: 5 }) // find the table with id=5
 * Table.findOne(5) // find the table with id=5 (shortcut)
 * ```
 *
 * Table.findOne is synchronous (no need to await), But the functions that
 * query and manipulate (such as {@link Table.insertRow}, {@link Table.getRows},
 * {@link Table.updateRow}, {@link Table.deleteRows}) rows are mostly asyncronous,
 * so you can put the await in front of the
 * whole expression
 *
 * @example
 * To count the number of rows in the customer table
 * ```
 * const nrows = await Table.findOne("Customers").countRows()
 * ```
 *
 * For further examples, see the [Table test suite](https://github.com/saltcorn/saltcorn/blob/master/packages/saltcorn-data/tests/table.test.ts)
 *
 * ## Querying table rows
 *
 * There are several methods you can use to retrieve rows in the database:
 *
 * * {@link Table.countRows} To count the number of rows, optionally matching a criterion
 * * {@link Table.getRows} To retrieve multiple rows matching a criterion
 * * {@link Table.getRow} To retrieve a single row matching a criterion
 * * {@link Table.getJoinedRows} To retrieve rows together with joinfields and aggregations
 *
 * These functions all take `Where` expressions which are JavaScript objects describing
 * the criterion to match to. Some examples:
 *
 * * `{}`: Match all rows
 * * `{ name: "Jim" }`: Match all rows with name="Jim"
 * * `{ name: { ilike: "im"} }`: Match all rows where name contains "im" (case insensitive)
 * * `{ name: /im/ }`: Match all rows with name matching regular expression "im"
 * * `{ age: { lt: 18 } }`: Match all rows with age<18
 * * `{ age: { lt: 18, equal: true } }`: Match all rows with age<=18
 * * `{ age: { gt: 18, lt: 65} }`: Match all rows with 18<age<65
 * * `{ name: { or: ["Harry", "Sally"] } }`: Match all rows with name="Harry" or "Sally"
 * * `{ or: [{ name: "Joe"}, { age: 37 }] }`: Match all rows with name="Joe" or age=37
 * * `{ not: { id: 5 } }`: All rows except id=5
 * * `{ id: { in: [1, 2, 3] } }`: Rows with id 1, 2, or 3
 * * `{ id: { not: { in: [1, 2, 3] } } }`: Rows with id any value except 1, 2, or 3
 *
 * For further examples, see the [mkWhere test suite](https://github.com/saltcorn/saltcorn/blob/master/packages/db-common/internal.test.js)
 *
 * ## Updating a Row
 *
 * There are two nearly identical functions for updating rows depending on how you want
 * failures treated
 *
 * * {@link Table.updateRow} Update a row, throws an exception if update is invalid
 * * {@link Table.tryUpdateRow} Update a row, return an error message if update is invalid
 *
 * ## Inserting a new Row
 *
 * There are two nearly identical functions for inserting a new row depending on how you want
 * failures treated
 *
 * * {@link Table.insertRow} insert a row, throws an exception if it is invalid
 * * {@link Table.tryInsertRow} insert a row, return an error message if it is invalid
 *
 * ## Deleting rows
 *
 * Use {@link Table.deleteRows} to delete any number (zero, one or many) of rows matching a criterion. It uses
 * the same `where` expression as the functions for querying rows
 *
 *
 * @category saltcorn-data
 */
class Table implements AbstractTable {
  /** The table name */
  name: string;

  /** The table ID */
  id?: number;

  /** Minimum role to read */
  min_role_read: number;

  /** Minimum role to write */
  min_role_write: number;

  /** The ID of the ownership field*/
  ownership_field_id?: string;

  /** A formula to denote ownership. This is a JavaScript expression which
   * must evaluate to true if the user is the owner*/
  ownership_formula?: string;

  /** Version history enabled for this table */
  versioned: boolean;

  /** Whether sync info for mobile apps is enabled for this table */
  has_sync_info: boolean;

  /** If true this is an external table (not a database table) */
  external: boolean;

  /** A description of the purpose of the table */
  description?: string;

  /** An array of {@link Field}s in this table */
  fields: Field[];

  /** An array of {@link TableConstraint}s for this table */
  constraints: TableConstraint[];

  /** Is this a user group? If yes it will appear as options in the ownership dropdown */
  is_user_group: boolean;

  /** Name of the table provider for this table (not a database table) */
  provider_name?: string;

  /** Configuration for the table provider for this table */
  provider_cfg?: any;
  /**
   * Table constructor
   * @param {object} o
   */
  constructor(o: TableCfg) {
    this.name = o.name;
    this.id = o.id;
    this.min_role_read = o.min_role_read;
    this.min_role_write = o.min_role_write;
    this.ownership_field_id = o.ownership_field_id;
    this.ownership_formula = o.ownership_formula;
    this.versioned = !!o.versioned;
    this.has_sync_info = !!o.has_sync_info;
    this.is_user_group = !!o.is_user_group;
    this.external = false;
    this.description = o.description;
    this.constraints = o.constraints || [];
    this.provider_cfg = stringToJSON(o.provider_cfg);
    this.provider_name = o.provider_name;

    this.fields = o.fields.map((f) => new Field(f));
  }

  get to_json() {
    return {
      name: this.name,
      id: this.id,
      min_role_read: this.min_role_read,
      min_role_write: this.min_role_write,
      provider_name: this.provider_name,
      ownership_formula: this.ownership_formula,
      ownership_field_id: this.ownership_field_id,
      provider_cfg: this.provider_cfg,
      external: this.external,
      versioned: this.versioned,
      fields: this.fields.map((f) => f.toJson),
    };
  }

  to_provided_table() {
    const tbl = this;
    if (!tbl.provider_name) return this;
    const { getState } = require("../db/state");

    const provider = getState().table_providers[tbl.provider_name];
    const { getRows } = provider.get_table(tbl.provider_cfg, tbl);

    const { json_list_to_external_table } = require("../plugin-helper");
    const t = json_list_to_external_table(getRows, tbl.fields);
    delete t.min_role_read; //it is a getter
    Object.assign(t, tbl);
    t.update = async (upd_rec: any) => {
      const { fields, constraints, ...updDB } = upd_rec;
      await db.update("_sc_tables", updDB, tbl.id);
      await require("../db/state").getState().refresh_tables();
    };
    t.delete = async (upd_rec: any) => {
      const schema = db.getTenantSchemaPrefix();
      await db.deleteWhere("_sc_tag_entries", { table_id: this.id });
      await db.query(`delete FROM ${schema}_sc_tables WHERE id = $1`, [tbl.id]);
      await require("../db/state").getState().refresh_tables();
    };
    return t;
  }

  /**
   *
   * Find one Table
   *
   * @param where - where condition
   * @returns {*|Table|null} table or null
   */
  static findOne(where: Where | Table | number | string): Table | null {
    if (
      where &&
      ((where.constructor && where.constructor.name === "Table") ||
        (where as any).getRows)
    )
      return <Table>where;
    // todo add string & number as possible types for where
    if (typeof where === "string") return Table.findOne({ name: where });
    if (typeof where === "number") return Table.findOne({ id: where });

    const { getState } = require("../db/state");

    // it works because external table hasn't id so can be found only by name
    if (where?.name) {
      const extTable = getState().external_tables[where.name];
      if (extTable) return extTable;
    }

    const tbl = getState().tables.find(
      where?.id
        ? (v: TableCfg) => v.id === +where.id
        : where?.name
        ? (v: TableCfg) => v.name === where.name
        : satisfies(where)
    );
    if (tbl?.provider_name) {
      return new Table(structuredClone(tbl)).to_provided_table();
    } else return tbl ? new Table(structuredClone(tbl)) : null;
  }

  /**
   * Find Tables
   * @param where - where condition
   * @param selectopts - options
   * @returns {Promise<Table[]>} table list
   */
  static async find(
    where?: Where,
    selectopts: SelectOptions = { orderBy: "name", nocase: true }
  ): Promise<Table[]> {
    if (selectopts.cached) {
      const { getState } = require("../db/state");
      return getState()
        .tables.map((t: TableCfg) => new Table(structuredClone(t)))
        .filter(satisfies(where || {}));
    }

    if (where?.name) {
      const { getState } = require("../db/state");
      const extTable = getState().external_tables[where.name];
      if (extTable) return [extTable];
    }

    const tbls = await db.select("_sc_tables", where, selectopts);

    const flds = await db.select(
      "_sc_fields",
      db.isSQLite ? {} : { table_id: { in: tbls.map((t: TableCfg) => t.id) } },
      selectopts
    );
    const _TableConstraint = (await import("./table_constraints")).default;

    const constraints = await _TableConstraint.find(
      db.isSQLite ? {} : { table_id: { in: tbls.map((t: TableCfg) => t.id) } }
    );

    return await asyncMap(tbls, async (t: TableCfg) => {
      if (t.provider_name) {
        const { getState } = require("../db/state");
        const provider = getState().table_providers[t.provider_name];
        t.fields = await applyAsync(provider.fields, t.provider_cfg);
      } else
        t.fields = flds
          .filter((f: any) => f.table_id === t.id)
          .map((f: any) => new Field(f));

      t.constraints = constraints
        .filter((f: any) => f.table_id === t.id)
        .map((f: any) => new _TableConstraint(f));
      const tbl = new Table(t);
      return tbl.to_provided_table();
    });
  }

  /**
   * Find Tables including external tables
   * @param where0
   * @param selectopts
   * @returns {Promise<object[]>}
   */
  static async find_with_external(
    where0: Where = {},
    selectopts: SelectOptions = { orderBy: "name", nocase: true }
  ): Promise<Table[]> {
    const { external, ...where } = where0;
    let externals: any[] = [],
      dbs = [];
    if (external !== false) {
      //do include externals
      const { getState } = require("../db/state");
      externals = Object.values(getState().external_tables);
    }
    if (external !== true) {
      //do include db tables
      const tbls = await db.select("_sc_tables", where, selectopts);
      const flds = await db.select(
        "_sc_fields",
        db.isSQLite
          ? {}
          : { table_id: { in: tbls.map((t: TableCfg) => t.id) } },
        selectopts
      );
      dbs = tbls.map((t: TableCfg) => {
        t.fields = flds
          .filter((f: any) => f.table_id === t.id)
          .map((f: any) => new Field(f));

        return new Table(t);
      });
    }
    return [...dbs, ...externals];
  }

  /**
   * Get Models
   * tbd why this function in this file - needs to models
   * @param opts
   */
  async get_models(opts?: any) {
    const Model = require("./model");
    if (typeof opts === "string")
      return await Model.find({ name: opts, table_id: this.id });
    else return await Model.find({ ...(opts || {}), table_id: this.id });
  }

  /**
   * Get owner column name
   * @param fields - fields list
   * @returns {null|*} null or owner column name
   */
  owner_fieldname_from_fields(
    fields?: Field[] | null
  ): string | null | undefined {
    if (!this.ownership_field_id || !fields) return null;
    const field = fields.find((f: Field) => f.id === this.ownership_field_id);
    return field?.name;
  }

  /**
   * Get owner column name
   * @returns {Promise<string|null|*>}
   */
  owner_fieldname(): string | null | undefined {
    if (this.name === "users") return "id";
    if (!this.ownership_field_id) return null;
    return this.owner_fieldname_from_fields(this.fields);
  }

  /**
   * Check if user is owner of row
   * @param user - user
   * @param row - table row
   * @returns {Promise<string|null|*|boolean>}
   */
  is_owner(user: any, row: Row): boolean {
    if (!user) return false;

    if (this.ownership_formula && this.fields) {
      const f = get_expression_function(this.ownership_formula, this.fields);
      return !!f(row, user);
    }
    const field_name = this.owner_fieldname();

    // users are owners of their own row in users table
    if (this.name === "users" && !field_name)
      return user.id && `${row?.id}` === `${user.id}`;

    return typeof field_name === "string" && row[field_name] === user.id;
  }

  /**
   * get Ownership options
   * user interface...
   */
  async ownership_options(): Promise<{ label: string; value: string }[]> {
    const fields = this.fields;

    //start with userfields
    const opts: { label: string; value: string }[] = fields
      .filter((f) => f.reftable_name === "users")
      .map((f) => ({ value: `${f.id}`, label: f.name }));

    const users = Table.findOne({ name: "users" });
    for (const ufield of users?.fields || []) {
      if (ufield.is_fkey && ufield.reftable_name === this.name) {
        opts.push({
          label: `users.${ufield.label} [Key to ${this.name}]`,
          value: `Fml:user.${ufield.name}===id /* users.${ufield.label} */`,
        });
      }
    }
    // inherit from all my fks if table has ownership
    for (const field of fields) {
      if (field.is_fkey && field.reftable_name) {
        const refTable = Table.findOne({ name: field.reftable_name });

        if (refTable?.ownership_field_id) {
          //todo find in table.fields so we dont hit db
          const ofield = await Field.findOne({
            id: refTable?.ownership_field_id,
          });
          if (ofield)
            opts.push({
              label: `Inherit ${field.label}`,
              value: `Fml:${field.name}?.${ofield.name}===user.id /* Inherit ${field.label} */`,
            });
        }
        if (refTable?.ownership_formula) {
          const refFml = removeComments(refTable.ownership_formula);
          if (refFml.startsWith("user.") && !refFml.includes(".includes(")) {
            for (const ufield of users?.fields || []) {
              if (
                ufield.is_fkey &&
                refFml.startsWith(`user.${ufield.name}===`)
              ) {
                const sides = refFml.split("===");
                const newFml = `${sides[0]}===${field.name}.${sides[1]}`;
                opts.push({
                  label: `Inherit ${field.label}`,
                  value: `Fml:${newFml} /* Inherit ${field.label} */`,
                });
              }
            }
          }
          if (refFml.endsWith("==user.id")) {
            const path = refTable.ownership_formula
              .replace("===user.id", "")
              .replace("==user.id", "")
              .split(".");
            const fldNms = new Set((refTable?.fields || []).map((f) => f.name));
            if (fldNms.has(path[0])) {
              opts.push({
                label: `Inherit ${field.label}`,
                value: `Fml:${field.name}?.${refFml} /* Inherit ${field.label} */`,
              });
            }
          }
          if (refFml.startsWith("user.") && refFml.includes(".includes(")) {
            const [_pre, post] = refFml.split(").includes(");
            const ref = post.substring(0, post.length - 1);
            if (ref === this.pk_name) {
              const fml = refFml.replace(
                `.includes(${this.pk_name})`,
                `.includes(${field.name})`
              );
              opts.push({
                label: `Inherit ${field.label}`,
                value: `Fml:${fml} /* Inherit ${field.label} */`,
              });
            } else {
              const fml = refFml.replace(
                `.includes(${ref})`,
                `.includes(${field.name}?.${ref})`
              );

              opts.push({
                label: `Inherit ${field.label}`,
                value: `Fml:${fml} /* Inherit ${field.label} */`,
              });
            }
          }
        }
      }
    }

    // get user groups
    const tables = await Table.find({}, { cached: true });
    for (const ugtable of tables) {
      if (ugtable.is_user_group) {
        // /user.usergroups_by_user.map(g=>g.group).includes(group)
        const ugfields = await ugtable.getFields();
        const ug_to_user = ugfields.find((f) => f.reftable_name === "users");
        if (!ug_to_user) continue;

        // direct field from user group to me
        const ug_to_me = ugfields.find((f) => f.reftable_name === this.name);
        if (ug_to_me) {
          opts.push({
            label: `In ${ugtable.name} user group by ${ug_to_me.label}`,
            value: `Fml:user.${sqlsanitize(ugtable.name)}_by_${
              ug_to_user.name
            }.map(g=>g.${ug_to_me.name}).includes(${
              this.pk_name
            }) /* User group ${ugtable.name} */`,
          });
        }

        // there is a field from this table to user group
        for (const field of fields) {
          if (field.is_fkey && field.reftable_name === ugtable.name) {
            //const to_me = ugfields.find((f) => f.reftable_name === "users");
            opts.push({
              label: `In ${ugtable.name} user group by ${field.label}`,
              value: `Fml:user.${ugtable.name}_by_${ug_to_user.name}.map(g=>g.${ugtable.pk_name}).includes(${field.name})`,
            });
          }
        }
      }
    }
    return opts;
  }

  /**
   * get sanitized name of table
   */
  get santized_name() {
    return sqlsanitize(this.name);
  }
  /**
   * Create table
   * @param name - table name
   * @param options - table fields
   * @param id - optional id, if set, no '_sc_tables' entry is inserted
   * @returns {Promise<Table>} table
   */
  static async create(
    name: string,
    options: SelectOptions | TablePack = {}, //TODO not selectoptions
    id?: number
  ): Promise<Table> {
    let pk_type: string = "Integer";
    let pk_sql_type = db.isSQLite ? "integer" : "serial";
    if (options?.fields && Array.isArray(options.fields)) {
      const pk_field = (options.fields as any).find?.(
        (f: Field) => typeof f !== "string" && f?.primary_key
      );
      pk_type =
        (typeof pk_field === "string"
          ? pk_field
          : typeof pk_field?.type === "string"
          ? pk_field?.type
          : pk_field?.type?.name) || "Integer";
    }
    if (pk_type !== "Integer") {
      const { getState } = require("../db/state");

      const type = getState().types[pk_type];
      pk_sql_type = type.sql_name;
      if (type.primaryKey?.default_sql)
        pk_sql_type = `${type.sql_name} default ${type.primaryKey?.default_sql}`;
    }

    const schema = db.getTenantSchemaPrefix();
    // create table in database
    if (!options.provider_name)
      await db.query(
        `create table ${schema}"${sqlsanitize(
          name
        )}" (id ${pk_sql_type} primary key)`
      );
    // populate table definition row
    const tblrow: any = {
      name,
      versioned: options.versioned || false,
      has_sync_info: options.has_sync_info || false,
      min_role_read: options.min_role_read || 1,
      min_role_write: options.min_role_write || 1,
      ownership_field_id: options.ownership_field_id,
      ownership_formula: options.ownership_formula,
      description: options.description || "",
      provider_name: options.provider_name,
      provider_cfg: options.provider_cfg,
    };
    let pk_fld_id;
    if (!id) {
      // insert table definition into _sc_tables
      id = await db.insert("_sc_tables", tblrow);
      // add primary key column ID
      if (!options.provider_name) {
        const insfldres = await db.query(
          `insert into ${schema}_sc_fields(table_id, name, label, type, attributes, required, is_unique,primary_key)
            values($1,'id','ID','${pk_type}', '{}', true, true, true) returning id`,
          [id]
        );
        pk_fld_id = insfldres.rows[0].id;
      }
    }
    // create table
    //const provider = getState().table_providers[tbl.provider_name];
    //provider.get_table(tbl.provider_cfg, tbl);
    const fields = options?.provider_name
      ? [] //TODO look up
      : [
          new Field({
            type: pk_type,
            name: "id",
            label: "ID",
            primary_key: true,
            required: true,
            is_unique: true,
            table_id: id,
            id: pk_fld_id,
          }),
        ];
    const table = new Table({
      ...tblrow,
      id,
      fields,
    });

    // create table history
    if (table?.versioned) await table.create_history_table();
    // create sync info
    if (table.has_sync_info) await table.create_sync_info_table();
    // refresh tables cache
    await require("../db/state").getState().refresh_tables();

    return table;
  }

  /**
   * Drop current table
   * @param only_forget boolean - if true that only
   * @returns {Promise<void>}
   */
  // tbd check all other tables related to table description
  async delete(only_forget: boolean = false): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    const is_sqlite = db.isSQLite;
    await this.update({ ownership_field_id: null });
    const client = is_sqlite ? db : await db.getClient();
    await client.query(`BEGIN`);
    try {
      // drop table
      if (!only_forget)
        await client.query(
          `drop table if exists ${schema}"${sqlsanitize(this.name)}"`
        );
      // delete tag entries from _sc_tag_entries
      await db.deleteWhere("_sc_tag_entries", { table_id: this.id });
      // delete fields
      await client.query(
        `delete FROM ${schema}_sc_fields WHERE table_id = $1`,
        [this.id]
      );
      // delete table description
      await client.query(`delete FROM ${schema}_sc_tables WHERE id = $1`, [
        this.id,
      ]);
      // delete versioned table
      if (this.versioned)
        await client.query(
          `drop table if exists ${schema}"${sqlsanitize(this.name)}__history"`
        );

      await client.query(`COMMIT`);
    } catch (e) {
      await client.query(`ROLLBACK`);
      if (!is_sqlite) client.release(true);
      throw e;
    }
    if (!is_sqlite) client.release(true);
    await require("../db/state").getState().refresh_tables();
  }

  /***
   * Get Table SQL Name
   * @type {string}
   */
  get sql_name(): string {
    return `${db.getTenantSchemaPrefix()}"${sqlsanitize(this.name)}"`;
  }

  /**
   * Reset Sequence
   */
  async resetSequence() {
    const fields = this.fields;
    const pk = fields.find((f) => f.primary_key);
    if (!pk) {
      throw new Error("Unable to find a field with a primary key.");
    }

    if (
      db.reset_sequence &&
      instanceOfType(pk.type) &&
      pk.type.name === "Integer"
    )
      await db.reset_sequence(this.name);
  }

  /**
   * update Where with Ownership
   * @param where
   * @param fields
   * @param user
   * @param forRead
   */
  private updateWhereWithOwnership(
    where: Where,
    fields: Field[],
    user?: Row,
    forRead?: boolean
  ): { notAuthorized?: boolean } | undefined {
    const role = user?.role_id;
    const min_role = forRead ? this.min_role_read : this.min_role_write;
    if (
      role &&
      role > min_role &&
      ((!this.ownership_field_id && !this.ownership_formula) || role === 100)
    )
      return { notAuthorized: true };
    if (user && role < 100 && role > min_role && this.ownership_field_id) {
      const owner_field = fields.find((f) => f.id === this.ownership_field_id);
      if (!owner_field)
        throw new Error(`Owner field in table ${this.name} not found`);
      mergeIntoWhere(where, {
        [owner_field.name]: user.id,
      });
    }
  }

  private async addDeleteSyncInfo(ids: Row[], timestamp: Date): Promise<void> {
    if (ids.length > 0) {
      const schema = db.getTenantSchemaPrefix();
      const pkName = this.pk_name || "id";
      if (isNode()) {
        await db.query(
          `delete from ${schema}"${db.sqlsanitize(
            this.name
          )}_sync_info" where ref in (
            ${ids.map((row) => row[pkName]).join(",")})`
        );
        await db.query(
          `insert into ${schema}"${db.sqlsanitize(
            this.name
          )}_sync_info" values ${ids
            .map(
              (row) =>
                `(${row[pkName]}, date_trunc('milliseconds', to_timestamp( ${
                  timestamp.valueOf() / 1000.0
                } ) ), true)`
            )
            .join(",")}`
        );
      } else {
        await db.query(
          `update "${db.sqlsanitize(this.name)}_sync_info"
           set deleted = true, modified_local = true
           where ref in (${ids.map((row) => row[pkName]).join(",")})`
        );
      }
    }
  }

  /**
   * Delete rows from table. The first argument is a where expression indicating the conditions for the rows to be deleted
   *
   * @example
   * ```
   * // delete all books where author = "Friedrich Nietzsche"
   * await Table.findOne({name: "books"}).deleteRows({author: "Friedrich Nietzsche"})
   * ```
   *
   * @param where - condition
   * @param user - optional user, if null then no authorization will be checked
   * @returns
   */
  async deleteRows(where: Where, user?: Row, noTrigger?: boolean) {
    // get triggers on delete
    const triggers = await Trigger.getTableTriggers("Delete", this);
    const fields = this.fields;

    if (this.updateWhereWithOwnership(where, fields, user)?.notAuthorized) {
      const state = require("../db/state").getState();
      state.log(4, `Not authorized to deleteRows in table ${this.name}.`);
      return;
    }
    let rows;
    if (user && user.role_id > this.min_role_write && this.ownership_formula) {
      rows = await this.getJoinedRows({
        where,
        forUser: user,
      });
    }

    const deleteFileFields = fields.filter(
      (f) => f.type === "File" && f.attributes?.also_delete_file
    );
    const deleteFiles = [];
    if ((triggers.length > 0 || deleteFileFields.length > 0) && !noTrigger) {
      const File = require("./file");

      if (!rows)
        rows = await this.getJoinedRows({
          where,
        });
      for (const trigger of triggers) {
        for (const row of rows) {
          // run triggers on delete
          await trigger.run!(row);
        }
      }
      if (isNode()) {
        for (const deleteFile of deleteFileFields) {
          for (const row of rows) {
            if (row[deleteFile.name]) {
              const file = await File.findOne({
                filename: row[deleteFile.name],
              });
              deleteFiles.push(file);
            }
          }
        }
      }
    }
    if (rows) {
      const delIds = rows.map((r) => r[this.pk_name]);
      if (!db.isSQLite) {
        await db.deleteWhere(this.name, {
          [this.pk_name]: { in: delIds },
        });
      } else {
        await db.query(
          `delete from "${db.sqlsanitize(this.name)}" where "${db.sqlsanitize(
            this.pk_name
          )}" in (${delIds.join(",")})`
        );
      }
      if (this.has_sync_info) {
        const dbTime = await db.time();
        await this.addDeleteSyncInfo(rows, dbTime);
      }
    } else {
      const delIds = this.has_sync_info
        ? await db.select(this.name, where, {
            fields: [this.pk_name],
          })
        : null;

      await db.deleteWhere(this.name, where);
      if (this.has_sync_info) {
        const dbTime = await db.time();
        await this.addDeleteSyncInfo(delIds, dbTime);
      }
    }
    //if (fields.find((f) => f.primary_key)) await this.resetSequence();
    for (const file of deleteFiles) {
      await file.delete();
    }
  }

  /**
   * Returns row with only fields that can be read from db (readFromDB flag)
   * @param row
   * @returns {*}
   */
  private readFromDB(row: Row): any {
    if (this.fields) {
      for (const f of this.fields) {
        if (f.type && instanceOfType(f.type) && f.type.readFromDB)
          row[f.name] = f.type.readFromDB(row[f.name]);
      }
    }
    return row;
  }

  /**
   * Get one row from the table in the database. The matching row will be returned in a promise - use await to read the value.
   * If no matching rule can be found, null will be returned. If more than one row matches, the first found row
   * will be returned.
   *
   * The first argument to get row is a where-expression With the conditions the returned row should match.
   *
   * The second document is optional and is an object that can modify the search. This is mainly useful
   * in case there is more than one matching row for the where-expression in the first argument and you
   * want to give an explicit order. For example, use `{orderBy: "name"}` as the second argument to pick
   * the first row by the name field, ordered ascending. `{orderBy: "name", orderDesc: true}` to order by name,
   * descending
   *
   * This is however rare and usually getRow is run with a single argument of a
   * Where expression that uniquely determines the row to return, if it exisits.
   *
   * @example
   * ```
   * const bookTable = Table.findOne({name: "books"})
   *
   *
   * // get the row in the book table with id = 5
   * const myBook = await bookTable.getRow({id: 5})
   *
   * // get the row for the last book published by Leo Tolstoy
   * const myBook = await bookTable.getRow({author: "Leo Tolstoy"}, {orderBy: "published", orderDesc: true})
   * ```
   *
   * @param where
   * @param selopts
   * @returns {Promise<null|*>}
   */
  async getRow(
    where: Where = {},
    selopts: SelectOptions & ForUserRequest = {}
  ): Promise<Row | null> {
    const fields = this.fields;
    const { forUser, forPublic, ...selopts1 } = selopts;
    const role = forUser ? forUser.role_id : forPublic ? 100 : null;
    const row = await db.selectMaybeOne(
      this.name,
      where,
      this.processSelectOptions(selopts1)
    );
    if (!row || !this.fields) return null;
    if (role && role > this.min_role_read) {
      //check ownership
      if (forPublic) return null;
      else if (this.ownership_field_id) {
        const owner_field = fields.find(
          (f) => f.id === this.ownership_field_id
        );
        if (!owner_field)
          throw new Error(`Owner field in table ${this.name} not found`);
        if (row[owner_field.name] !== (forUser as AbstractUser).id) return null;
      } else if (this.ownership_formula || this.name === "users") {
        if (!this.is_owner(forUser, row)) return null;
      } else return null; //no ownership
    }
    return apply_calculated_fields([this.readFromDB(row)], this.fields)[0];
  }

  /**
   * Get all matching rows from the table in the database.
   *
   * The arguments are the same as for getRow. The first argument is where-expression with the conditions to match,
   * and the second argument is an optional object and allows you to set ordering and limit options. Keywords that
   * can be used in the second argument are orderBy, orderDesc, limit and offset.
   *
   * getRows will return an array of rows matching the where-expression in the first argument, wrapped in a Promise
   * (use await to read the array).
   *
   * @example
   * ```
   * const bookTable = Table.findOne({name: "books"})
   *
   * // get the rows in the book table with author = "Henrik Pontoppidan"
   * const myBooks = await bookTable.getRows({author: "Henrik Pontoppidan"})
   *
   * // get the 3 most recent books written by "Henrik Pontoppidan" with more that 500 pages
   * const myBooks = await bookTable.getRows({author: "Henrik Pontoppidan", pages: {gt: 500}}, {orderBy: "published", orderDesc: true})
   * ```
   *
   * @param where
   * @param selopts
   * @returns {Promise<void>}
   */
  async getRows(
    where: Where = {},
    selopts: SelectOptions & ForUserRequest = {}
  ): Promise<Row[]> {
    const fields = this.fields;
    if (!this.fields) return [];
    const { forUser, forPublic, ...selopts1 } = selopts;
    const role = forUser ? forUser.role_id : forPublic ? 100 : null;
    if (
      role &&
      this.updateWhereWithOwnership(
        where,
        fields,
        forUser || { role_id: 100 },
        true
      )?.notAuthorized
    ) {
      return [];
    }

    let rows = await db.select(
      this.name,
      where,
      this.processSelectOptions(selopts1)
    );
    if (role && role > this.min_role_read) {
      //check ownership
      if (forPublic) return [];
      else if (this.ownership_field_id) {
        //already dealt with by changing where
      } else if (this.ownership_formula || this.name === "users") {
        rows = rows.filter((row: Row) => this.is_owner(forUser, row));
      } else return []; //no ownership
    }

    return apply_calculated_fields(
      rows.map((r: Row) => this.readFromDB(r)),
      this.fields,
      !!selopts.ignore_errors
    );
  }

  processSelectOptions(
    selopts: SelectOptions & ForUserRequest = {}
  ): SelectOptions & ForUserRequest {
    if (
      typeof selopts?.orderBy === "object" &&
      "operator" in selopts?.orderBy &&
      typeof selopts.orderBy.operator === "string"
    ) {
      const field = this.getField(selopts.orderBy.field);
      if (!instanceOfType(field?.type)) return selopts;
      const operator =
        field?.type?.distance_operators?.[selopts.orderBy.operator];
      selopts.orderBy.operator = operator;
    }
    return selopts;
  }

  /**
   * Count the number of rows in db table. The argument is a where-expression with conditions the
   * counted rows should match. countRows returns the number of matching rows wrapped in a promise.
   *
   * @example
   * ```
   * const bookTable = Table.findOne({name: "books"})
   *
   * // Count the total number of rows in the books table
   * const totalNumberOfBooks = await bookTable.countRows({})
   *
   * // Count the number of books where the cover_color field has the value is "Red"
   * const numberOfRedBooks = await bookTable.countRows({cover_color: "Red"})
   *
   * // Count number of books with more than 500 pages
   * const numberOfLongBooks = await bookTable.countRows({pages: {gt: 500}})
   * ```
   * @param where
   * @returns {Promise<number>}
   */
  async countRows(where?: Where, opts?: ForUserRequest): Promise<number> {
    return await db.count(this.name, where);
  }

  /**
   * Return distinct Values for column in table
   * ????
   * @param fieldnm
   * @returns {Promise<Object[]>}
   */
  async distinctValues(fieldnm: string, whereObj?: object): Promise<any[]> {
    if (whereObj) {
      const { where, values } = mkWhere(whereObj, db.isSQLite);
      const res = await db.query(
        `select distinct "${db.sqlsanitize(fieldnm)}" from ${
          this.sql_name
        } ${where}`,
        values
      );
      return res.rows.map((r: Row) => r[fieldnm]);
    } else {
      const res = await db.query(
        `select distinct "${db.sqlsanitize(fieldnm)}" from ${this.sql_name}`
      );
      return res.rows.map((r: Row) => r[fieldnm]);
    }
  }

  /**
   *
   */
  private storedExpressionJoinFields() {
    let freeVars: Set<string> = new Set([]);
    for (const f of this.fields!)
      if (f.calculated && f.stored && f.expression)
        freeVars = new Set([...freeVars, ...freeVariables(f.expression)]);
    const joinFields = {};
    const { add_free_variables_to_joinfields } = require("../plugin-helper");
    add_free_variables_to_joinfields(freeVars, joinFields, this.fields);
    return joinFields;
  }

  /**
   * Update a single row in the table database.
   *
   * The first two arguments are mandatory. The first is an object with the new values to set in the row.
   * The second argument is the value of the primary key of the row to update. Typically this is the id
   * field of an existing row object
   *
   * @example
   * ```
   * const bookTable = Table.findOne({name: "books"})
   *
   * // get the row in the book table for Moby Dick
   * const moby_dick = await bookTable.getRow({title: "Moby Dick"})
   *
   * // Update the read field to true and the rating field to 5
   * await bookTable.updateRow({read: true, rating: 5}, moby_dick.id)
   *
   * // if you want to update more than one row, you must first retrieve all the rows and
   * // then update them individually
   *
   * const allBooks = await bookTable.getRows()
   * for(const book of allBooks) {
   *   await bookTable.updateRow({price: book.price*0.8}, book.id)
   * }
   * ```
   * @param v_in - columns with values to update
   * @param id - id value
   * @param _userid - user id
   * @param noTrigger
   * @param resultCollector
   * @returns
   */
  async updateRow(
    v_in: any,
    id: any,
    user?: Row,
    noTrigger?: boolean,
    resultCollector?: object,
    restore_of_version?: any,
    syncTimestamp?: Date
  ): Promise<string | void> {
    let existing;
    let v = { ...v_in };
    const fields = this.fields;
    const pk_name = this.pk_name;
    const role = user?.role_id;
    const state = require("../db/state").getState();

    if (typeof id === "undefined")
      throw new Error(
        this.name + " updateRow called without primary key value"
      );
    if (id === null)
      throw new Error(
        this.name + " updateRow called with null as primary key value"
      );

    let joinFields = {};
    if (fields.some((f: Field) => f.calculated && f.stored)) {
      joinFields = this.storedExpressionJoinFields();
    }
    if (this.ownership_formula)
      add_free_variables_to_joinfields(
        freeVariables(this.ownership_formula),
        joinFields,
        fields
      );

    if (
      user &&
      role &&
      (role > this.min_role_write || role > this.min_role_read)
    ) {
      if (role === 100) return "Not authorized"; //no possibility of ownership
      if (this.ownership_field_id) {
        const owner_field = fields.find(
          (f) => f.id === this.ownership_field_id
        );
        if (!owner_field)
          throw new Error(`Owner field in table ${this.name} not found`);
        if (v[owner_field.name] && v[owner_field.name] !== user.id) {
          state.log(
            4,
            `Not authorized to updateRow in table ${this.name}. ${user.id} does not match owner field in updates`
          );
          return "Not authorized";
        }

        //need to check existing
        if (!existing)
          existing = await this.getJoinedRow({
            where: { [pk_name]: id },
            forUser: user,
            joinFields,
          });
        if (!existing || existing?.[owner_field.name] !== user.id) {
          state.log(
            4,
            `Not authorized to updateRow in table ${this.name}. ${user.id} does not match owner field in exisiting`
          );
          return "Not authorized";
        }
      }
      if (this.ownership_formula) {
        if (!existing)
          existing = await this.getJoinedRow({
            where: { [pk_name]: id },
            forUser: user,
            joinFields,
          });

        if (!existing || !this.is_owner(user, existing)) {
          state.log(
            4,
            `Not authorized to updateRow in table ${
              this.name
            }. User does not match formula: ${JSON.stringify(user)}`
          );
          return "Not authorized";
        }
      }
      if (!this.ownership_field_id && !this.ownership_formula) {
        state.log(
          4,
          `Not authorized to updateRow in table ${this.name}. No ownership`
        );
        return "Not authorized";
      }
    }
    if (this.constraints.filter((c) => c.type === "Formula").length) {
      if (!existing)
        existing = await this.getJoinedRow({
          where: { [pk_name]: id },
          forUser: user,
          joinFields,
        });
      const newRow = { ...existing, ...v };
      let constraint_check = this.check_table_constraints(newRow);
      if (constraint_check) return constraint_check;
    }
    if (user) {
      let field_write_check = this.check_field_write_role(v, user);
      if (field_write_check) return field_write_check;
    }

    //check validation here
    if (Trigger.hasTableTriggers("Validate", this)) {
      if (!existing)
        existing = await this.getJoinedRow({
          where: { [pk_name]: id },
          forUser: user,
          joinFields,
        });
      const valResCollector: any = resultCollector || {};
      await Trigger.runTableTriggers(
        "Validate",
        this,
        { ...existing, ...v },
        valResCollector,
        user,
        { old_row: existing, updated_fields: v_in }
      );
      if ("error" in valResCollector) return valResCollector.error as string;
      if ("set_fields" in valResCollector)
        Object.assign(v, valResCollector.set_fields);
    }

    if (fields.some((f: Field) => f.calculated && f.stored)) {
      //if any freevars are join fields, update row in db first
      const freeVarFKFields = new Set(
        Object.values(joinFields).map((jf: any) => jf.ref)
      );
      let need_to_update = Object.keys(v_in).some((k) =>
        freeVarFKFields.has(k)
      );
      existing = await this.getJoinedRow({
        where: { [pk_name]: id },
        forUser: user,
        joinFields,
      });
      let updated;
      if (need_to_update) {
        state.log(
          6,
          `Updating ${this.name} because calculated fields: ${JSON.stringify(
            v
          )}, id=${id}`
        );
        await db.update(this.name, v, id, { pk_name });
        updated = await this.getJoinedRow({
          where: { [pk_name]: id },
          forUser: user,
          joinFields,
        });
      }

      let calced = await apply_calculated_fields_stored(
        need_to_update ? updated : { ...existing, ...v_in },
        // @ts-ignore TODO ch throw ?
        this.fields,
        this
      );

      for (const f of fields)
        if (f.calculated && f.stored) v[f.name] = calced[f.name];
    }

    if (this.versioned) {
      const existing1 = await db.selectOne(this.name, { [pk_name]: id });
      if (!existing) existing = existing1;
      await this.insert_history_row({
        ...existing1,
        ...v,
        [pk_name]: id,
        _version: {
          next_version_by_id: id,
        },
        _time: new Date(),
        _userid: user?.id,
        _restore_of_version: restore_of_version || null,
      });
    }
    if (typeof existing === "undefined") {
      const triggers = await Trigger.getTableTriggers("Update", this);
      if (triggers.length > 0)
        existing = await this.getJoinedRow({
          where: { [pk_name]: id },
          forUser: user,
          joinFields,
        });
    }
    state.log(6, `Updating ${this.name}: ${JSON.stringify(v)}, id=${id}`);
    await db.update(this.name, v, id, { pk_name });

    if (this.has_sync_info) {
      const oldInfo = await this.latestSyncInfo(id);
      if (oldInfo && !oldInfo.deleted)
        await this.updateSyncInfo(id, oldInfo.last_modified, syncTimestamp);
      else await this.insertSyncInfo(id, syncTimestamp);
    }
    const newRow = { ...existing, ...v, [pk_name]: id };
    if (!noTrigger) {
      const trigPromise = Trigger.runTableTriggers(
        "Update",
        this,
        newRow,
        resultCollector,
        role === 100 ? undefined : user,
        { old_row: existing, updated_fields: v_in }
      );
      if (resultCollector) await trigPromise;
    }
  }

  async insert_history_row(v0: any, retry = 0) {
    // sometimes there is a race condition in history inserts
    // https://dba.stackexchange.com/questions/212580/concurrent-transactions-result-in-race-condition-with-unique-constraint-on-inser
    // solution: retry 3 times, if fails run with on conflict do nothing

    //legacy workaround: delete calc fields which may be in row
    const calcFields = this.fields.filter((f) => f.calculated && !f.stored);
    const v1 = { ...v0 };
    calcFields.forEach((f) => {
      // delete v1[f.name];
    });

    if (retry < 3) {
      try {
        await db.insert(this.name + "__history", v1);
      } catch (error) {
        await this.insert_history_row(v1, retry + 1);
      }
    } else {
      await db.insert(this.name + "__history", v1, {
        onConflictDoNothing: true,
      });
    }
  }

  async latestSyncInfo(id: any) {
    const rows = await this.latestSyncInfos([id]);
    return rows?.length === 1 ? rows[0] : null;
  }

  async latestSyncInfos(ids: any[]) {
    const schema = db.getTenantSchemaPrefix();
    const dbResult = await db.query(
      `select max(last_modified) "last_modified", ref
       from ${schema}"${db.sqlsanitize(this.name)}_sync_info"
       group by ref having ref = ${db.isSQLite ? "" : "ANY"} ($1)`,
      [ids]
    );
    return dbResult.rows;
  }

  private async insertSyncInfo(id: any, syncTimestamp?: Date) {
    const schema = db.getTenantSchemaPrefix();
    if (isNode()) {
      await db.query(
        `insert into ${schema}"${db.sqlsanitize(
          this.name
        )}_sync_info" values($1,
        date_trunc('milliseconds', to_timestamp($2)))`,
        [
          id,
          (syncTimestamp ? syncTimestamp : await db.time()).valueOf() / 1000.0,
        ]
      );
    } else {
      await db.query(
        `insert into "${db.sqlsanitize(this.name)}_sync_info"
         (ref, modified_local, deleted) 
         values('${id}', true, false)`
      );
    }
  }

  private async updateSyncInfo(
    id: any,
    oldLastModified: Date,
    syncTimestamp?: Date
  ) {
    const schema = db.getTenantSchemaPrefix();
    if (!db.isSQLite) {
      await db.query(
        `update ${schema}"${db.sqlsanitize(
          this.name
        )}_sync_info" set last_modified=date_trunc('milliseconds', to_timestamp($1)) where ref=$2 and last_modified = to_timestamp($3)`,
        [
          (syncTimestamp ? syncTimestamp : await db.time()).valueOf() / 1000.0,
          id,
          oldLastModified.valueOf() / 1000.0,
        ]
      );
    } else {
      await db.query(
        `update "${db.sqlsanitize(
          this.name
        )}_sync_info" set modified_local = true 
         where ref = ${id} and last_modified = ${
          oldLastModified ? oldLastModified.valueOf() : "null"
        }`
      );
    }
  }

  /**
   * Try to Update row
   * @param v
   * @param id
   * @param _userid
   * @param resultCollector
   * @returns {Promise<{error}|{success: boolean}>}
   */
  async tryUpdateRow(
    v: any,
    id: any,
    user?: Row,
    resultCollector?: object
  ): Promise<ResultMessage> {
    try {
      const maybe_err = await this.updateRow(
        v,
        id,
        user,
        false,
        resultCollector
      );
      if (typeof maybe_err === "string") return { error: maybe_err };
      else return { success: true };
    } catch (e: any) {
      return { error: this.normalise_error_message(e.message) };
    }
  }

  /**
   * ????
   * @param id
   * @param field_name
   * @returns {Promise<void>}
   */
  async toggleBool(id: any, field_name: string, user?: Row): Promise<void> {
    const row = await this.getRow({ [this.pk_name]: id });
    if (row) await this.updateRow({ [field_name]: !row[field_name] }, id, user);
  }

  /**
   * Get primary key field name
   * @type {string}
   */
  get pk_name(): string {
    const pkField = this.fields?.find((f: Field) => f.primary_key)?.name;
    if (!pkField) {
      throw new Error("A primary key field is mandatory");
    }
    return pkField;
  }

  get pk_type(): Type {
    const pkField = this.fields?.find((f: Field) => f.primary_key);
    if (!pkField) {
      throw new Error("A primary key field is mandatory");
    }
    if (!instanceOfType(pkField.type)) {
      throw new Error("A primary key field must have a type");
    }
    return pkField.type;
  }

  /**
   * Check table constraints against a row object. Will return a string With an error message if the
   * table constraints are violated, `undefined` if the row does not violate any constraints
   *
   * @param row
   */

  check_table_constraints(row0: Row): string | undefined {
    const row = { ...row0 };
    this.fields.forEach((f) => {
      if (typeof row[f.name] === "undefined") row[f.name] = null;
    });

    const fmls = this.constraints
      .filter((c) => c.type === "Formula")
      .map((c) => c.configuration);
    for (const { formula, errormsg } of fmls) {
      if (!eval_expression(formula, row, undefined, "Contraint formula"))
        return errormsg;
    }
    return undefined;
  }

  /**
   *
   * @param row
   * @param user
   */
  private check_field_write_role(row: Row, user: Row): string | undefined {
    for (const field of this.fields) {
      if (
        typeof row[field.name] !== "undefined" &&
        field.attributes?.min_role_write &&
        user.role_id > field.attributes?.min_role_write
      )
        return "Not authorized";
    }
    return undefined;
  }

  /**
   * Insert row into the table. By passing in the user as
   * the second argument, tt will check write rights. If a user object is not
   * supplied, the insert goes ahead without checking write permissions.
   *
   * Returns the primary key value of the inserted row.
   *
   * This will throw an exception if the row
   * does not conform to the table constraints. If you would like to insert a row
   * with a function that can return an error message, use {@link Table.tryInsertRow} instead.
   *
   * @example
   * ```
   * await Table.findOne("People").insertRow({ name: "Jim", age: 35 })
   * ```
   *
   * @param v_in
   * @param user
   * @param resultCollector
   * @returns {Promise<*>}
   */
  async insertRow(
    v_in: Row,
    user?: Row,
    resultCollector?: object,
    noTrigger?: boolean,
    syncTimestamp?: Date
  ): Promise<any> {
    const fields = this.fields;
    const pk_name = this.pk_name;
    const joinFields = this.storedExpressionJoinFields();
    if (this.ownership_formula)
      add_free_variables_to_joinfields(
        freeVariables(this.ownership_formula),
        joinFields,
        fields
      );
    let v, id;
    const state = require("../db/state").getState();
    if (user && user.role_id > this.min_role_write) {
      if (this.ownership_field_id) {
        const owner_field = fields.find(
          (f) => f.id === this.ownership_field_id
        );
        if (!owner_field)
          throw new Error(`Owner field in table ${this.name} not found`);
        if (v_in[owner_field.name] !== user.id) {
          state.log(
            4,
            `Not authorized to insertRow in table ${this.name}. ${user.id} does not match owner field`
          );

          return;
        }
      }
      if (!this.ownership_field_id && !this.ownership_formula) {
        state.log(
          4,
          `Not authorized to insertRow in table ${this.name}. No ownership.`
        );
        return;
      }
    }
    let constraint_check = this.check_table_constraints(v_in);
    if (constraint_check) throw new Error(constraint_check);
    if (user) {
      let field_write_check = this.check_field_write_role(v_in, user);
      if (field_write_check) return field_write_check;
    }
    //check validate here based on v_in
    const valResCollector: any = resultCollector || {};
    await Trigger.runTableTriggers(
      "Validate",
      this,
      { ...v_in },
      valResCollector,
      user
    );
    if ("error" in valResCollector) return valResCollector; //???
    if ("set_fields" in valResCollector)
      Object.assign(v_in, valResCollector.set_fields);

    if (
      Object.keys(joinFields).length > 0 ||
      fields.some((f) => f.expression === "__aggregation")
    ) {
      state.log(
        6,
        `Inserting ${this.name} because join fields: ${JSON.stringify(v_in)}`
      );
      id = await db.insert(this.name, v_in, { pk_name });
      let existing = await this.getJoinedRows({
        where: { [pk_name]: id },
        joinFields,
        forUser: user,
      });
      if (!existing?.[0]) {
        //failed ownership test
        if (id) await db.deleteWhere(this.name, { [pk_name]: id });
        state.log(
          4,
          `Not authorized to insertRow in table ${this.name}. Inserted row not retrieved.`
        );
        return;
      }

      let calced = await apply_calculated_fields_stored(
        existing[0],
        fields,
        this
      );
      v = { ...v_in };

      for (const f of fields)
        if (f.calculated && f.stored) v[f.name] = calced[f.name];
      state.log(
        6,
        `Updating ${this.name} because join fields: ${JSON.stringify(v_in)}`
      );
      await db.update(this.name, v, id, { pk_name });
    } else {
      v = await apply_calculated_fields_stored(v_in, fields, this);
      state.log(6, `Inserting ${this.name} row: ${JSON.stringify(v)}`);
      id = await db.insert(this.name, v, { pk_name });
    }
    if (user && user.role_id > this.min_role_write && this.ownership_formula) {
      let existing = await this.getJoinedRow({
        where: { [pk_name]: id },
        joinFields,
        forUser: user,
      });

      if (!existing || !this.is_owner(user, existing)) {
        await this.deleteRows({ [pk_name]: id });
        state.log(
          4,
          `Not authorized to insertRow in table ${
            this.name
          }. User does not match formula: ${JSON.stringify(user)}`
        );
        return;
      }
    }
    if (this.versioned)
      await this.insert_history_row({
        ...v,
        [pk_name]: id,
        _version: {
          next_version_by_id: id,
        },
        _userid: user?.id,
        _time: new Date(),
      });

    if (this.has_sync_info) {
      if (isNode()) {
        const schemaPrefix = db.getTenantSchemaPrefix();
        await db.query(
          `insert into ${schemaPrefix}"${db.sqlsanitize(this.name)}_sync_info"
           values(${id}, date_trunc('milliseconds', to_timestamp(${
            (syncTimestamp ? syncTimestamp : await db.time()).valueOf() / 1000.0
          })))`
        );
      } else {
        await db.query(
          `insert into "${db.sqlsanitize(this.name)}_sync_info"
           (last_modified, ref, modified_local, deleted)
           values(NULL, ${id}, true, false)`
        );
      }
    }
    if (!noTrigger) {
      const trigPromise = Trigger.runTableTriggers(
        "Insert",
        this,
        { [pk_name]: id, ...v },
        resultCollector,
        user
      );
      if (resultCollector) await trigPromise;
    }
    return id;
  }

  /**
   * Try to Insert row
   * @param v
   * @param _userid
   * @param resultCollector
   * @returns {Promise<{error}|{success: *}>}
   */
  async tryInsertRow(
    v: Row,
    user?: Row,
    resultCollector?: object
  ): Promise<{ error: string } | { success: any }> {
    try {
      const id = await this.insertRow(v, user, resultCollector);
      if (!id) return { error: "Not authorized" };
      if (id?.includes?.("Not authorized")) return { error: id };
      if (id?.error) return id;
      return { success: id };
    } catch (e: any) {
      await require("../db/state").getState().log(5, e);
      return { error: this.normalise_error_message(e.message) };
    }
  }

  /**
   *
   * @param msg
   */
  normalise_error_message(msg: string): string {
    let fieldnm: string = "";
    if (msg.toLowerCase().includes("unique constraint")) {
      if (db.isSQLite) {
        fieldnm = msg.replace(
          `SQLITE_CONSTRAINT: UNIQUE constraint failed: ${this.name}.`,
          ""
        );
      } else {
        const m = msg.match(
          /duplicate key value violates unique constraint "(.*?)_(.*?)_unique"/
        );
        if (m) fieldnm = m[2];
      }
      if (fieldnm) {
        const field = this.fields.find((f) => f.name === fieldnm);
        if (field?.attributes?.unique_error_msg)
          return field?.attributes?.unique_error_msg;
        else {
          const tc_unique = this.constraints.find((c) => {
            if (c.type !== "Unique") return false;
            let conNm = "";
            if (db.isSQLite) {
              // SQLITE_CONSTRAINT: UNIQUE constraint failed: books.author, books.pages
              // first table name stripped by replace
              let [field1, ...rest_fields] = c.configuration.fields;
              conNm = [
                field1,
                ...rest_fields.map((fnm: string) => `${this.name}.${fnm}`),
              ].join(", ");
            } else {
              conNm = c.configuration.fields.join("_");
            }
            return c.configuration.errormsg && conNm === fieldnm;
          });

          if (tc_unique) return tc_unique.configuration.errormsg;
          return `Duplicate value for unique field: ${field?.label || fieldnm}`;
        }
      }
    }
    return msg;
  }

  /**
   * Get Fields list for table
   * @returns {Promise<Field[]>}
   */
  getFields(): Field[] {
    return this.fields;
  }

  /**
   * get foreign keys, without the 'File' type
   * @returns array of FK Fields
   */
  getForeignKeys(): Field[] {
    return this.fields.filter((f) => f.is_fkey && f.type !== "File");
  }

  /**
   * Get a field, possibly by relation
   * @returns {Promise<Field | undefined>}
   */
  getField(path: string): Field | undefined {
    const fields = this.fields;
    if (path.includes("->")) {
      const joinPath = path.split(".");
      const tableName = joinPath[0];
      const joinTable = Table.findOne({ name: tableName });
      if (!joinTable)
        throw new Error(`The table '${tableName}' does not exist.`);
      const joinedField = joinPath[1].split("->")[1];
      const fields = joinTable.getFields();
      return fields.find((f) => f.name === joinedField);
    } else if (path.includes(".")) {
      const keypath = path.split(".");
      let field,
        theFields = fields;
      for (let i = 0; i < keypath.length; i++) {
        const refNm = keypath[i];
        field = theFields.find((f) => f.name === refNm);
        if (!field || !field.reftable_name) break;
        const table = Table.findOne({ name: field.reftable_name });
        if (!table) break;
        theFields = table.fields;
      }
      return field;
    } else return fields.find((f) => f.name === path);
  }

  /**
   * Create history table
   * @returns {Promise<void>}
   */
  // todo create function that returns history table name for table
  private async create_history_table(): Promise<void> {
    const schemaPrefix = db.getTenantSchemaPrefix();

    const fields = this.fields;
    const flds = fields
      .filter((f) => !f.calculated || f.stored)
      .map((f: Field) => `,"${sqlsanitize(f.name)}" ${f.sql_bare_type}`);
    const pk = fields.find((f) => f.primary_key)?.name;
    if (!pk) {
      throw new Error("Unable to find a field with a primary key.");
    }

    // create history table
    await db.query(
      `create table ${schemaPrefix}"${sqlsanitize(this.name)}__history" (
          _version integer,
          _time timestamp,
          _restore_of_version integer,
          _userid integer
          ${flds.join("")}
          ,PRIMARY KEY("${pk}", _version)
          );`
    );
  }

  private async create_sync_info_table(): Promise<void> {
    const schemaPrefix = db.getTenantSchemaPrefix();
    const fields = this.fields;
    const pk = fields.find((f) => f.primary_key)?.name;
    if (!pk) {
      throw new Error("Unable to find a field with a primary key.");
    }
    await db.query(
      `create table ${schemaPrefix}"${sqlsanitize(
        this.name
      )}_sync_info" (ref integer, last_modified timestamp, deleted boolean default false)`
    );
    await db.query(
      `create index "${sqlsanitize(
        this.name
      )}_sync_info_ref_index" on ${schemaPrefix}"${sqlsanitize(
        this.name
      )}_sync_info"(ref)`
    );
    await db.query(
      `create index "${sqlsanitize(
        this.name
      )}_sync_info_lm_index" on ${schemaPrefix}"${sqlsanitize(
        this.name
      )}_sync_info"(last_modified)`
    );
    await db.query(
      `create index "${sqlsanitize(
        this.name
      )}_sync_info_deleted_index" on ${schemaPrefix}"${sqlsanitize(
        this.name
      )}_sync_info"(deleted)`
    );
  }

  private async drop_sync_table(): Promise<void> {
    const schemaPrefix = db.getTenantSchemaPrefix();
    await db.query(`
      drop table ${schemaPrefix}"${sqlsanitize(this.name)}_sync_info";`);
  }

  /**
   * Restore Row Version
   * @param id
   * @param version
   * @param user
   */
  async restore_row_version(
    id: any,
    version: number,
    user?: Row
  ): Promise<void> {
    const row = await db.selectOne(`${db.sqlsanitize(this.name)}__history`, {
      id,
      _version: version,
    });
    var r: any = {};
    this.fields.forEach((f: Field) => {
      if (!f.calculated) r[f.name] = row[f.name];
    });
    //console.log("restore_row_version", r);

    await this.updateRow(r, id, user, false, undefined, version);
  }

  /**
   * Undo row chnages
   * @param id
   * @param user
   */
  async undo_row_changes(id: any, user?: Row): Promise<void> {
    const current_version_row = await db.selectMaybeOne(
      `${sqlsanitize(this.name)}__history`,
      { id },
      { orderBy: "_version", orderDesc: true, limit: 1 }
    );
    //get max that is not a restore
    const last_non_restore = await db.selectMaybeOne(
      `${sqlsanitize(this.name)}__history`,
      {
        id,
        _version: {
          lt: current_version_row._restore_of_version
            ? current_version_row._restore_of_version
            : current_version_row._version,
        },
      },
      { orderBy: "_version", orderDesc: true, limit: 1 }
    );
    if (last_non_restore) {
      await this.restore_row_version(id, last_non_restore._version, user);
    }
  }

  /**
   * Redo row changes
   * @param id
   * @param user
   */
  async redo_row_changes(id: any, user?: Row): Promise<void> {
    const current_version_row = await db.selectMaybeOne(
      `${sqlsanitize(this.name)}__history`,
      { id },
      { orderBy: "_version", orderDesc: true, limit: 1 }
    );

    if (current_version_row._restore_of_version) {
      const next_version = await db.selectMaybeOne(
        `${sqlsanitize(this.name)}__history`,
        {
          id,
          _version: {
            gt: current_version_row._restore_of_version,
          },
        },
        { orderBy: "_version", limit: 1 }
      );

      if (next_version) {
        await this.restore_row_version(id, next_version._version, user);
      }
    }
  }

  async compress_history(interval_secs: number) {
    if (typeof interval_secs !== "number" || interval_secs < 0.199)
      throw new Error(
        "compress_history mush be called with a number greater than 0.2 seconds"
      );
    const schemaPrefix = db.getTenantSchemaPrefix();

    await db.query(`
      delete from ${schemaPrefix}"${sqlsanitize(this.name)}__history" 
        where (${sqlsanitize(this.pk_name)}, _version) in (
          select h1.${sqlsanitize(this.pk_name)}, h1._version
          FROM ${schemaPrefix}"${sqlsanitize(this.name)}__history" h1
          JOIN ${schemaPrefix}"${sqlsanitize(
      this.name
    )}__history" h2 ON h1.${sqlsanitize(this.pk_name)} = h2.${sqlsanitize(
      this.pk_name
    )}
          AND h1._version < h2._version
          AND h1._time < h2._time
          AND h2._time - h1._time <= INTERVAL '${+interval_secs} seconds'
        );`);
  }
  /**
   * Drop history table
   * @returns {Promise<void>}
   */
  private async drop_history_table(): Promise<void> {
    const schemaPrefix = db.getTenantSchemaPrefix();

    await db.query(`
      drop table ${schemaPrefix}"${sqlsanitize(this.name)}__history";`);
  }

  /**
   * Rename table
   * @param new_name
   * @returns {Promise<void>}
   */
  async rename(new_name: string): Promise<void> {
    //in transaction
    if (db.isSQLite)
      throw new InvalidAdminAction("Cannot rename table on SQLite");
    const schemaPrefix = db.getTenantSchemaPrefix();

    const client = await db.getClient();
    await client.query(`BEGIN`);
    try {
      //rename table
      await db.query(
        `alter table ${schemaPrefix}"${sqlsanitize(
          this.name
        )}" rename to "${sqlsanitize(new_name)}";`
      );
      //change refs
      await db.query(
        `update ${schemaPrefix}_sc_fields set reftable_name=$1 where reftable_name=$2`,
        [new_name, this.name]
      );
      //rename history
      if (this.versioned)
        await db.query(
          `alter table ${schemaPrefix}"${sqlsanitize(
            this.name
          )}__history" rename to "${sqlsanitize(new_name)}__history";`
        );
      //1. change record
      await this.update({ name: new_name });
      await client.query(`COMMIT`);
    } catch (e) {
      await client.query(`ROLLBACK`);
      client.release(true);
      throw e;
    }
    client.release(true);
    await require("../db/state").getState().refresh_tables();
  }

  /**
   * Update Table description in _sc_table
   * Also creates / drops history table for table
   * @param new_table_rec
   * @returns {Promise<void>}
   */
  async update(new_table_rec: any): Promise<void> {
    if (new_table_rec.ownership_field_id === "")
      delete new_table_rec.ownership_field_id;
    const existing = Table.findOne({ id: this.id });
    if (!existing) {
      throw new Error(`Unable to find table with id: ${this.id}`);
    }
    const { external, fields, constraints, ...upd_rec } = new_table_rec;
    await db.update("_sc_tables", upd_rec, this.id);
    await require("../db/state").getState().refresh_tables();

    const new_table = Table.findOne({ id: this.id });
    if (!new_table) {
      throw new Error(`Unable to find table with id: ${this.id}`);
    } else {
      if (new_table.versioned && !existing.versioned) {
        await new_table.create_history_table();
      } else if (!new_table.versioned && existing.versioned) {
        await new_table.drop_history_table();
      }
      if (new_table.has_sync_info && !existing.has_sync_info) {
        await this.create_sync_info_table();
      } else if (!new_table.has_sync_info && existing.has_sync_info) {
        await new_table.drop_sync_table();
      }
      Object.assign(this, new_table_rec);
    }
  }

  /**
   * Get table history data
   * @param id
   * @returns {Promise<*>}
   */
  async get_history(id?: number): Promise<Row[]> {
    return await db.select(
      `${sqlsanitize(this.name)}__history`,
      id ? { id } : {},
      { orderBy: "_version" }
    );
  }

  /**
   * Enable constraints
   * @returns {Promise<void>}
   */
  async enable_fkey_constraints(): Promise<void> {
    const fields = this.fields;
    for (const f of fields) await f.enable_fkey_constraint(this);
  }

  /**
   * Table Create from CSV
   * @param name
   * @param filePath
   * @returns {Promise<{error: string}|{error: string}|{error: string}|{error: string}|{error: string}|{success: string}|{error: (string|string|*)}>}
   */
  static async create_from_csv(
    name: string,
    filePath: string
  ): Promise<ResultMessage> {
    let rows;
    const state = await require("../db/state").getState();
    try {
      let lines_limit = state.getConfig("csv_types_detection_rows", 500);
      if (!lines_limit || lines_limit < 0) lines_limit = 500; // default

      const s = await getLines(filePath, lines_limit);
      rows = await csvtojson().fromString(s); // t
    } catch (e) {
      return { error: `Error processing CSV file` };
    }
    const rowsTr = transposeObjects(rows);
    const table = await Table.create(name);
    //
    const isBools = state
      .getConfig("csv_bool_values", "true false yes no on off y n t f")
      .split(" ");

    for (const [k, vs] of Object.entries(rowsTr)) {
      const required = (<any[]>vs).every((v: any) => v !== "");
      const nonEmpties = (<any[]>vs).filter((v: any) => v !== "");

      let type;
      if (
        nonEmpties.every((v: any) =>
          //https://www.postgresql.org/docs/11/datatype-boolean.html

          isBools.includes(v && v.toLowerCase && v.toLowerCase())
        )
      )
        type = "Bool";
      else if (nonEmpties.every((v: any) => !isNaN(v)))
        if (nonEmpties.every((v: any) => Number.isSafeInteger(+v)))
          type = "Integer";
        else type = "Float";
      else if (nonEmpties.every((v: any) => isDate(v))) type = "Date";
      else type = "String";
      const label = (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");

      //can fail here if: non integer id, duplicate headers, invalid name

      const fld = new Field({
        name: Field.labelToName(k),
        required,
        type,
        table,
        label,
      });
      //console.log(fld);
      if (db.sqlsanitize(k.toLowerCase()) === "id") {
        if (type !== "Integer") {
          await table.delete();
          return { error: `Columns named "id" must have only integers` };
        }
        if (!required) {
          await table.delete();
          return { error: `Columns named "id" must not have missing values` };
        }
        continue;
      }
      if (db.sqlsanitize(fld.name) === "") {
        await table.delete();
        return {
          error: `Invalid column name ${k} - Use A-Z, a-z, 0-9, _ only`,
        };
      }
      try {
        await Field.create(fld);
      } catch (e: any) {
        await table.delete();
        return { error: `Error in header ${k}: ${e.message}` };
      }
    }
    const parse_res = await table.import_csv_file(filePath);
    if (instanceOfErrorMsg(parse_res)) {
      await table.delete();
      return { error: parse_res.error };
    }

    parse_res.table = table;
    await require("../db/state").getState().refresh_tables();

    return parse_res;
  }

  /**
   *
   * @param state
   */
  read_state_strict(state: Row): Row | string {
    let errorString = "";
    this.fields.forEach((f) => {
      const current = state[f.name];
      //console.log(f.name, current, typeof current);

      if (typeof current !== "undefined") {
        if (instanceOfType(f.type) && f.type?.read) {
          const readval = f.type?.read(current);
          if (typeof readval === "undefined") {
            if (current === "" && !f.required) delete state[f.name];
            else errorString += `No valid value for required field ${f.name}. `;
          }
          if (f.type && f.type.validate) {
            const vres = f.type.validate(f.attributes || {})(readval);
            if (vres.error)
              errorString += `Validation error in field ${f.name}. `;
          }
          state[f.name] = readval;
        } else if (f.type === "Key")
          state[f.name] =
            current === "null" || current === "" || current === null
              ? null
              : +current;
        else if (f.type === "File")
          state[f.name] =
            current === "null" || current === "" || current === null
              ? null
              : current;
      } else if (f.required && !f.primary_key)
        errorString += `No valid value for required field ${f.name}. `;
    });
    return errorString || state;
  }

  /**
   * Import CSV file to existing table
   * @param filePath
   * @param recalc_stored
   * @param skip_first_data_row
   * @returns {Promise<{error: string}|{success: string}>}
   */
  async import_csv_file(
    filePath: string,
    options?: {
      recalc_stored?: boolean;
      skip_first_data_row?: boolean;
      no_table_write?: boolean;
    }
  ): Promise<ResultMessage> {
    if (typeof options === "boolean") {
      options = { recalc_stored: options };
    }
    let headers: string[];
    let headerStr;
    try {
      headerStr = await getLines(filePath, 1);
      [headers] = await csvtojson({
        output: "csv",
        noheader: true,
      }).fromString(headerStr); // todo argument type unknown
    } catch (e) {
      return { error: `Error processing CSV file header: ${headerStr}` };
    }
    const fields = this.fields.filter((f) => !f.calculated);
    const okHeaders: any = {};
    const pk_name = this.pk_name;
    const renames: any[] = [];
    const fkey_fields: Field[] = [];
    const json_schema_fields: Field[] = [];

    const state = require("../db/state").getState();

    for (const f of fields) {
      if (headers.includes(f.name)) okHeaders[f.name] = f;
      else if (headers.includes(f.label)) {
        okHeaders[f.label] = f;
        renames.push({ from: f.label, to: f.name });
      } else if (
        headers.map((h: string) => Field.labelToName(h)).includes(f.name)
      ) {
        okHeaders[f.name] = f;
        renames.push({
          from: headers.find((h: string) => Field.labelToName(h) === f.name),
          to: f.name,
        });
      } else if (
        instanceOfType(f.type) &&
        f.type?.name === "JSON" &&
        headers.some((h) => h.startsWith(`${f.name}.`))
      ) {
        const hs = headers.filter((h) => h.startsWith(`${f.name}.`));
        hs.forEach((h) => {
          const f1 = new Field({
            ...f,
            attributes: structuredClone(f.attributes),
          });
          f1.attributes.subfield = h.replace(`${f.name}.`, "");
          okHeaders[h] = f1;
          json_schema_fields.push(f1);
        });
      } else if (f.required && !f.primary_key) {
        return { error: `Required field missing: ${f.label}` };
      }
      if (
        f.is_fkey &&
        (okHeaders[f.name] || okHeaders[f.label]) &&
        f.attributes.summary_field
      )
        fkey_fields.push(f);
    }
    const fieldNames = headers.map((hnm: any) => {
      if (okHeaders[hnm]) return okHeaders[hnm].name;
    });
    // also id
    // todo support uuid
    if (headers.includes(`id`)) okHeaders.id = { type: "Integer" };

    const renamesInv: any = {};
    renames.forEach(({ from, to }) => {
      renamesInv[to] = from;
    });
    const colRe = new RegExp(
      `(${Object.keys(okHeaders)
        .map((k) => `^${renamesInv[k] || k}$`)
        .join("|")})`
    );

    let i = 1;
    let rejects = 0;
    let rejectDetails = "";
    const client = db.isSQLite ? db : await db.getClient();

    const stats = await stat(filePath);
    const fileSizeInMegabytes = stats.size / (1024 * 1024);

    // start sql transaction
    await client.query("BEGIN");

    const readStream = createReadStream(filePath);
    const returnedRows: any = [];

    try {
      // for files more 1MB
      if (db.copyFrom && fileSizeInMegabytes > 1) {
        let theError;

        const copyres = await db
          .copyFrom(readStream, this.name, fieldNames, client)
          .catch((cate: Error) => {
            theError = cate;
          });
        if (theError || (copyres && copyres.error)) {
          theError = theError || copyres.error;
          return {
            error: `Error processing CSV file: ${
              !theError
                ? theError
                : theError.error || theError.message || theError
            }`,
          };
        }
      } else {
        await new Promise<void>((resolve, reject) => {
          const imported_pk_set = new Set();
          const summary_field_cache: any = {};
          csvtojson({
            includeColumns: colRe,
          })
            .fromStream(readStream)
            .subscribe(
              async (rec: any) => {
                i += 1;
                if (options?.skip_first_data_row && i === 2) return;
                try {
                  renames.forEach(({ from, to }) => {
                    rec[to] = rec[from];
                    delete rec[from];
                  });

                  for (const jfield of json_schema_fields) {
                    const sf = jfield.attributes.subfield;
                    const jtype = jfield.attributes.schema.find(
                      ({ key }: { key: string }) => key === sf
                    );

                    if (rec[jfield.name][sf] === "")
                      delete rec[jfield.name][sf];
                    else if (
                      jtype?.type === "Integer" ||
                      jtype?.type === "Float"
                    ) {
                      rec[jfield.name][sf] = +rec[jfield.name][sf];
                      if (isNaN(rec[jfield.name][sf]))
                        delete rec[jfield.name][sf];
                    }
                  }

                  for (const fkfield of fkey_fields) {
                    const current = rec[fkfield.name];
                    if (
                      !(
                        current === "null" ||
                        current === "" ||
                        current === null
                      ) &&
                      isNaN(+current)
                    ) {
                      //need to look up summary fields
                      if (summary_field_cache[current])
                        rec[fkfield.name] = summary_field_cache[current];
                      else {
                        const tbl = Table.findOne({
                          name: fkfield.reftable_name,
                        });
                        const row = await tbl?.getRow({
                          [fkfield.attributes.summary_field]: current,
                        });
                        if (tbl && row) {
                          rec[fkfield.name] = row[tbl.pk_name];
                          summary_field_cache[current] = row[tbl.pk_name];
                        }
                      }
                      if (isNaN(+rec[fkfield.name])) {
                        rejectDetails += `Reject row ${i} because in field ${
                          fkfield.name
                        } value "${text(
                          current
                        )}" not matched by a value in table ${
                          fkfield.reftable_name
                        } field ${fkfield.attributes.summary_field}.\n`;
                        rejects += 1;
                        return;
                      }
                    }
                  }
                  const rowOk = this.read_state_strict(rec);

                  if (typeof rowOk !== "string") {
                    if (typeof rec[this.pk_name] !== "undefined") {
                      //TODO replace with upsert - optimisation
                      if (imported_pk_set.has(rec[this.pk_name]))
                        throw new Error(
                          "Duplicate primary key values: " + rec[this.pk_name]
                        );
                      imported_pk_set.add(rec[this.pk_name]);
                      const existing = await db.selectMaybeOne(this.name, {
                        [this.pk_name]: rec[this.pk_name],
                      });

                      if (options?.no_table_write) {
                        if (existing) {
                          Object.entries(existing).forEach(([k, v]) => {
                            if (typeof rec[k] === "undefined") rec[k] = v;
                          });
                        }
                        returnedRows.push(rec);
                      } else if (existing)
                        await db.update(this.name, rec, rec[this.pk_name], {
                          pk_name,
                          client,
                        });
                      else
                        try {
                          // TODO check constraints???
                          await db.insert(this.name, rec, {
                            noid: true,
                            client,
                            pk_name,
                          });
                        } catch (e: any) {
                          rejectDetails += `Reject row ${i} because: ${e?.message}\n`;
                          rejects += 1;
                        }
                    } else if (options?.no_table_write) {
                      returnedRows.push(rec);
                    } else
                      try {
                        // TODO check constraints???
                        await db.insert(this.name, rec, {
                          noid: true,
                          client,
                          pk_name,
                        });
                      } catch (e: any) {
                        rejectDetails += `Reject row ${i} because: ${e?.message}\n`;
                        rejects += 1;
                      }
                  } else {
                    rejectDetails += `Reject row ${i} because: ${rowOk}\n`;
                    rejects += 1;
                  }
                } catch (e: any) {
                  await client.query("ROLLBACK");

                  if (!db.isSQLite) await client.release(true);
                  reject({ error: `${e.message} in row ${i}` });
                }
              },
              (err: any) => {
                reject({ error: !err ? err : err.message || err });
              },
              () => {
                resolve();
              }
            );
        });
        readStream.destroy();
      }
    } catch (e: any) {
      return {
        error: `Error processing CSV file: ${
          !e ? e : e.error || e.message || e
        }`,
      };
    }

    if (rejectDetails)
      state.log(6, `CSV import rejectDetails: ` + rejectDetails);

    // stop sql transaction
    await client.query("COMMIT");

    if (!db.isSQLite) await client.release(true);

    if (options?.no_table_write) {
      return {
        success:
          `Found ${i > 1 ? i - 1 - rejects : ""} rows for table ${this.name}` +
          (rejects ? `. Rejected ${rejects} rows.` : ""),
        details: rejectDetails,
        rows: returnedRows,
      };
    }
    // reset id sequence
    await this.resetSequence();
    // recalculate fields
    if (
      options?.recalc_stored &&
      this.fields &&
      this.fields.some((f) => f.calculated && f.stored)
    ) {
      await recalculate_for_stored(this);
    }
    return {
      details: rejectDetails,
      success:
        `Imported ${i > 1 ? i - 1 - rejects : ""} rows into table ${
          this.name
        }` + (rejects ? `. Rejected ${rejects} rows.` : ""),
    };
  }

  /**
   * Import JSON table description
   * @param filePath
   * @param skip_first_data_row
   * @returns {Promise<{error: string}|{success: string}>}
   */
  async import_json_file(
    filePath: string,
    skip_first_data_row?: boolean
  ): Promise<any> {
    // todo argument type buffer is not assignable for type String...
    const file_rows = JSON.parse((await readFile(filePath)).toString());
    const fields = this.fields;
    const pk_name = this.pk_name;
    const { readState } = require("../plugin-helper");

    let i = 1;
    const client = db.isSQLite ? db : await db.getClient();
    await client.query("BEGIN");
    for (const rec of file_rows) {
      i += 1;
      if (skip_first_data_row && i === 2) continue;
      fields
        .filter((f) => f.calculated && !f.stored)
        .forEach((f) => {
          if (typeof rec[f.name] !== "undefined") {
            delete rec[f.name];
          }
        });
      try {
        readState(rec, fields);
        if (this.name === "users" && rec.role_id < 11 && rec.role_id > 1)
          rec.role_id = rec.role_id * 10;
        await db.insert(this.name, rec, { noid: true, client, pk_name });
      } catch (e: any) {
        await client.query("ROLLBACK");

        if (!db.isSQLite) await client.release(true);
        return { error: `${e.message} in row ${i}` };
      }
    }
    await client.query("COMMIT");
    if (!db.isSQLite) await client.release(true);

    await this.resetSequence();

    return {
      success: `Imported ${file_rows.length} rows into table ${this.name}`,
    };
  }

  /**
   * get join-field-options joined from a field in this table
   * @param allow_double
   * @param allow_triple
   * @returns
   */
  async get_join_field_options(
    allow_double?: boolean,
    allow_triple?: boolean
  ): Promise<JoinFieldOption[]> {
    const fields = this.fields;
    const result = [];
    for (const f of fields) {
      if (f.is_fkey && f.type !== "File") {
        const table = Table.findOne({ name: f.reftable_name });
        if (!table) throw new Error(`Unable to find table '${f.reftable_name}`);
        table.getFields();
        if (!table.fields)
          throw new Error(`The table '${f.reftable_name} has no fields.`);
        const subOne = {
          name: f.name,
          table: table.name,
          subFields: new Array<any>(),
          fieldPath: f.name,
        };
        for (const pf of table.fields.filter(
          (f: Field) => !f.calculated || f.stored
        )) {
          const subTwo: any = {
            name: pf.name,
            subFields: new Array<any>(),
            fieldPath: `${f.name}.${pf.name}`,
          };
          if (pf.is_fkey && pf.type !== "File" && allow_double) {
            const table1 = Table.findOne({ name: pf.reftable_name });
            if (!table1)
              throw new Error(`Unable to find table '${pf.reftable_name}`);
            await table1.getFields();
            subTwo.table = table1.name;
            if (!table1.fields)
              throw new Error(`The table '${pf.reftable_name} has no fields.`);
            if (table1.fields)
              for (const gpf of table1.fields.filter(
                (f: Field) => !f.calculated || f.stored
              )) {
                const subThree: any = {
                  name: gpf.name,
                  subFields: new Array<any>(),
                  fieldPath: `${f.name}.${pf.name}.${gpf.name}`,
                };
                if (allow_triple && gpf.is_fkey && gpf.type !== "File") {
                  const gpfTbl = Table.findOne({
                    name: gpf.reftable_name,
                  });
                  if (gpfTbl) {
                    subThree.table = gpfTbl.name;
                    const gpfFields = await gpfTbl.getFields();
                    for (const ggpf of gpfFields.filter(
                      (f: Field) => !f.calculated || f.stored
                    )) {
                      subThree.subFields.push({
                        name: ggpf.name,
                        fieldPath: `${f.name}.${pf.name}.${gpf.name}.${ggpf.name}`,
                      });
                    }
                  }
                }
                subTwo.subFields.push(subThree);
              }
          }
          subOne.subFields.push(subTwo);
        }
        result.push(subOne);
      }
    }
    return result;
  }

  /**
   * get relation-options joined from a field of another table
   * @returns
   */
  async get_relation_options(): Promise<RelationOption[]> {
    return await Promise.all(
      (
        await this.get_relation_data()
      ).map(async ({ relationTable, relationField }: RelationData) => {
        const path = `${relationTable.name}.${relationField.name}`;
        const relFields = await relationTable.getFields();
        const names = relFields
          .filter((f: Field) => f.type !== "Key")
          .map((f: Field) => f.name);
        return { relationPath: path, relationFields: names };
      })
    );
  }

  /**
   * get relation-data joined from a field of another table
   * @returns
   */
  async get_relation_data(unique = true): Promise<RelationData[]> {
    const result = new Array<RelationData>();
    const o2o_rels = await Field.find(
      {
        reftable_name: this.name,
        is_unique: unique,
      },
      { cached: true }
    );
    for (const field of o2o_rels) {
      const relTbl = Table.findOne({ id: field.table_id });
      if (relTbl) result.push({ relationTable: relTbl, relationField: field });
    }
    return result;
  }

  /**
   * Get parent relations for table
   * @param allow_double
   * @param allow_triple
   * @returns {Promise<{parent_relations: object[], parent_field_list: object[]}>}
   */
  async get_parent_relations(
    allow_double?: boolean,
    allow_triple?: boolean
  ): Promise<ParentRelations> {
    const fields = this.fields;
    let parent_relations = [];
    let parent_field_list = [];
    for (const f of fields) {
      if (f.is_fkey && f.type !== "File") {
        const table = Table.findOne({ name: f.reftable_name });
        if (!table) throw new Error(`Unable to find table '${f.reftable_name}`);
        table.getFields();
        if (!table.fields)
          throw new Error(`The table '${f.reftable_name} has no fields.`);

        for (const pf of table.fields.filter(
          (f: Field) => !f.calculated || f.stored
        )) {
          parent_field_list.push(`${f.name}.${pf.name}`);
          if (pf.is_fkey && pf.type !== "File" && allow_double) {
            const table1 = Table.findOne({ name: pf.reftable_name });
            if (!table1)
              throw new Error(`Unable to find table '${pf.reftable_name}`);
            await table1.getFields();
            if (!table1.fields)
              throw new Error(`The table '${pf.reftable_name} has no fields.`);
            if (table1.fields)
              for (const gpf of table1.fields.filter(
                (f: Field) => !f.calculated || f.stored
              )) {
                parent_field_list.push(`${f.name}.${pf.name}.${gpf.name}`);
                if (allow_triple && gpf.is_fkey && gpf.type !== "File") {
                  const gpfTbl = Table.findOne({
                    name: gpf.reftable_name,
                  });
                  if (gpfTbl) {
                    const gpfFields = await gpfTbl.getFields();
                    for (const ggpf of gpfFields.filter(
                      (f: Field) => !f.calculated || f.stored
                    )) {
                      parent_field_list.push(
                        `${f.name}.${pf.name}.${gpf.name}.${ggpf.name}`
                      );
                    }
                  }
                }
              }

            parent_relations.push({ key_field: pf, through: f, table: table1 });
          }
        }
        parent_relations.push({ key_field: f, table });
      }
    }
    const o2o_rels = await Field.find(
      {
        reftable_name: this.name,
        is_unique: true,
      },
      { cached: true }
    );
    for (const relation of o2o_rels) {
      const related_table = Table.findOne({ id: relation.table_id });
      if (related_table) {
        const relfields = await related_table.getFields();
        for (const relfield of relfields) {
          parent_field_list.push(
            `${related_table.name}.${relation.name}->${relfield.name}`
          );
          parent_relations.push({
            key_field: relation,
            ontable: related_table,
          });
        }
      }
    }

    return { parent_relations, parent_field_list };
  }

  async field_options(
    nrecurse: number = 0,
    fieldWhere: (f: Field) => boolean = () => true,
    prefix: string = ""
  ): Promise<string[]> {
    const fields = this.fields;
    const these = fields.filter(fieldWhere).map((f) => prefix + f.name);
    const those: string[] = [];
    if (nrecurse > 0)
      for (const field of fields) {
        if (field.is_fkey) {
          const thatTable = Table.findOne({ name: field.reftable_name });
          if (thatTable) {
            those.push(
              ...(await thatTable.field_options(
                nrecurse - 1,
                fieldWhere,
                prefix + field.name + "."
              ))
            );
          }
        }
      }
    return [...these, ...those];
  }

  /**
   * Get child relations for table
   * @returns {Promise<{child_relations: object[], child_field_list: object[]}>}
   */
  async get_child_relations(
    allow_join_aggregations?: boolean
  ): Promise<ChildRelations> {
    const cfields = await Field.find(
      { reftable_name: this.name },
      { cached: true }
    );
    let child_relations = [];
    let child_field_list = [];
    for (const f of cfields) {
      if (f.is_fkey) {
        const table = Table.findOne({ id: f.table_id });
        if (!table) {
          throw new Error(`Unable to find table with id: ${f.table_id}`);
        }
        child_field_list.push(`${table.name}.${f.name}`);
        table.getFields();
        child_relations.push({ key_field: f, table });
      }
    }
    if (allow_join_aggregations) {
      const fields = this.fields;
      for (const f of fields) {
        if (f.is_fkey && f.type !== "File") {
          const refTable = Table.findOne({ name: f.reftable_name });
          if (!refTable)
            throw new Error(`Unable to find table '${f.reftable_name}`);

          const join_crels = await refTable.get_child_relations(false);
          join_crels.child_relations.forEach(({ key_field, table }) => {
            child_field_list.push(`${f.name}->${table.name}.${key_field.name}`);
            child_relations.push({ key_field, table, through: f });
          });
        }
      }
    }
    return { child_relations, child_field_list };
  }

  /**
   * Returns aggregations for this table, possibly on a subset by where-expression
   */
  async aggregationQuery(
    aggregations: {
      [nm: string]: {
        field?: string;
        valueFormula?: string;
        aggregate: string;
      };
    },
    options?: {
      where?: any;
      groupBy?: string[] | string;
    }
  ): Promise<any> {
    let fldNms: string[] = [];
    const where0 = options?.where || {};
    const groupBy = Array.isArray(options?.groupBy)
      ? options?.groupBy
      : options?.groupBy
      ? [options?.groupBy]
      : null;
    const schema = db.getTenantSchemaPrefix();
    const { where, values } = mkWhere(where0, db.isSQLite);

    Object.entries(aggregations).forEach(
      ([nm, { field, valueFormula, aggregate }]) => {
        if (
          field &&
          (aggregate.startsWith("Percent ") || aggregate.startsWith("Percent "))
        ) {
          const targetBoolVal = aggregate.split(" ")[1] === "true";

          fldNms.push(
            `avg( CASE WHEN "${sqlsanitize(field)}"=${JSON.stringify(
              !!targetBoolVal
            )} THEN 100.0 ELSE 0.0 END) as "${sqlsanitize(nm)}"`
          );
        } else if (
          field &&
          (aggregate.startsWith("Latest ") || aggregate.startsWith("Earliest "))
        ) {
          const dateField = aggregate.split(" ")[1];
          const isLatest = aggregate.startsWith("Latest ");

          let newWhere = where;
          if (groupBy) {
            const newClauses = groupBy
              .map((f) => `innertbl."${f}" = mt."${f}"`)
              .join(" AND ");
            if (!newWhere) newWhere = "where " + newClauses;
            else newWhere = `${newWhere} AND ${newClauses}`;
          }
          fldNms.push(
            `(select ${
              field ? `"${sqlsanitize(field)}"` : valueFormula
            } from ${schema}"${sqlsanitize(
              this.name
            )}" innertbl ${newWhere} order by "${sqlsanitize(dateField)}" ${
              isLatest ? "DESC" : "ASC"
            } limit 1) as "${sqlsanitize(nm)}"`
          );
        } else
          fldNms.push(
            `${getAggAndField(
              aggregate,
              field === "Formula" ? undefined : field,
              field === "Formula" ? valueFormula : undefined
            )} as "${sqlsanitize(nm)}"`
          );
      }
    );
    if (groupBy) {
      fldNms.push(...groupBy);
    }

    const sql = `SELECT ${fldNms.join()} FROM ${schema}"${sqlsanitize(
      this.name
    )}" mt ${where}${
      groupBy
        ? ` group by ${groupBy.map((f) => sqlsanitize(f)).join(", ")}`
        : ""
    }`;

    const res = await db.query(sql, values);
    if (groupBy) return res.rows;
    return res.rows[0];
  }

  /**
   *
   * @param opts
   * @returns {Promise<{values, sql: string}>}
   */
  async getJoinedQuery(
    opts: (JoinOptions & ForUserRequest) | any = {}
  ): Promise<any> {
    const fields = this.fields;
    let fldNms = [];
    let joinq = "";
    let joinTables: string[] = [];
    let joinFields: JoinFields = opts.joinFields || {};
    let aggregations: any = opts.aggregations || {};
    const schema = db.getTenantSchemaPrefix();
    const { forUser, forPublic } = opts;
    const role = forUser ? forUser.role_id : forPublic ? 100 : null;
    if (role && role > this.min_role_read && this.ownership_formula) {
      const freeVars = freeVariables(this.ownership_formula);
      add_free_variables_to_joinfields(freeVars, joinFields, fields);
    }
    if (role && role > this.min_role_read && this.ownership_field_id) {
      if (forPublic) return { notAuthorized: true };
      const owner_field = fields.find((f) => f.id === this.ownership_field_id);
      if (!owner_field)
        throw new Error(`Owner field in table ${this.name} not found`);
      if (!opts.where) opts.where = {};
      mergeIntoWhere(opts.where, {
        [owner_field.name]: (forUser as AbstractUser).id,
      });
    }

    for (const [fldnm, { ref, target, through, ontable }] of Object.entries(
      joinFields
    )) {
      let reffield;
      if (ontable) {
        const ontableTbl = Table.findOne({ name: ontable });
        if (!ontableTbl)
          throw new InvalidConfiguration(
            `Related table ${ontable} not found in table ${this.name}`
          );
        reffield = (await ontableTbl.getFields()).find((f) => f.name === ref);
      } else {
        reffield = fields.find((f) => f.name === ref);
      }
      if (!reffield)
        throw new InvalidConfiguration(
          `Key field ${ref} not found in table ${this.name}`
        );
      const reftable = ontable || reffield.reftable_name;
      if (!reftable)
        throw new InvalidConfiguration(`Field ${ref} is not a key field`);
      const jtNm = `${sqlsanitize(reftable)}_jt_${sqlsanitize(ref)}`;
      if (!joinTables.includes(jtNm)) {
        joinTables.push(jtNm);
        if (ontable)
          joinq += `\n left join ${schema}"${sqlsanitize(
            reftable
          )}" ${jtNm} on ${jtNm}."${sqlsanitize(ref)}"=a."${reffield.refname}"`;
        else
          joinq += `\n left join ${schema}"${sqlsanitize(
            reftable
          )}" ${jtNm} on ${jtNm}."${reffield.refname}"=a."${sqlsanitize(ref)}"`;
      }
      if (through) {
        const throughs = Array.isArray(through) ? through : [through];
        let last_reffield = reffield;
        let jtNm1;
        let lastJtNm = jtNm;
        for (let i = 0; i < throughs.length; i++) {
          const through1 = throughs[i];
          const throughPath = throughs.slice(0, i + 1);
          const throughTable = Table.findOne({
            name: last_reffield.reftable_name,
          });
          if (!throughTable)
            throw new InvalidConfiguration(
              `Join-through table ${last_reffield.reftable_name} not found`
            );
          const throughTableFields = await throughTable.getFields();
          const throughRefField = throughTableFields.find(
            (f: Field) => f.name === through1
          );
          if (!throughRefField)
            throw new InvalidConfiguration(
              `Reference field field ${through} not found in table ${throughTable.name}`
            );
          const finalTable = throughRefField.reftable_name;
          jtNm1 = `${sqlsanitize(
            last_reffield.reftable_name as string
          )}_jt_${sqlsanitize(throughPath.join("_"))}_jt_${sqlsanitize(ref)}`;

          if (!joinTables.includes(jtNm1)) {
            if (!finalTable)
              throw new Error(
                "Unable to build a joind without a reftable_name."
              );
            joinTables.push(jtNm1);
            joinq += `\n left join ${schema}"${sqlsanitize(
              finalTable
            )}" ${jtNm1} on ${jtNm1}.id=${lastJtNm}."${sqlsanitize(through1)}"`;
          }

          last_reffield = throughRefField;
          lastJtNm = jtNm1;
        }
        // todo warning variable might not have been initialized
        fldNms.push(`${jtNm1}.${sqlsanitize(target)} as ${sqlsanitize(fldnm)}`);
      } else {
        fldNms.push(`${jtNm}.${sqlsanitize(target)} as ${sqlsanitize(fldnm)}`);
      }
    }
    if (opts.starFields) fldNms.push("a.*");
    else
      for (const f of fields.filter((f) => !f.calculated || f.stored)) {
        fldNms.push(`a."${sqlsanitize(f.name)}"`);
      }
    const whereObj = prefixFieldsInWhere(opts.where, "a");
    const { where, values } = mkWhere(whereObj, db.isSQLite);

    process_aggregations(this, aggregations, fldNms, values, schema);

    const selectopts: SelectOptions = this.processSelectOptions({
      limit: opts.limit,
      orderBy:
        opts.orderBy &&
        (orderByIsObject(opts.orderBy) || orderByIsOperator(opts.orderBy)
          ? opts.orderBy
          : joinFields[opts.orderBy] || aggregations[opts.orderBy]
          ? opts.orderBy
          : opts.orderBy.toLowerCase?.() === "random()"
          ? opts.orderBy
          : "a." + opts.orderBy),
      orderDesc: opts.orderDesc,
      offset: opts.offset,
    });

    const sql = `SELECT ${fldNms.join()} FROM ${schema}"${sqlsanitize(
      this.name
    )}" a ${joinq} ${where}  ${mkSelectOptions(
      selectopts,
      values,
      db.is_sqlite
    )}`;

    return { sql, values, joinFields };
  }

  /**
   * @param {object} [opts = {}]
   * @returns {Promise<object[]>}
   */
  async getJoinedRow(
    opts: (JoinOptions & ForUserRequest) | any = {}
  ): Promise<Row | null> {
    const rows = await this.getJoinedRows(opts);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get rows along with joined and aggregated fields. The argument to `getJoinedRows` is an object
   * with several different possible fields, all of which are optional
   *
   * * `where`: A Where expression indicating the criterion to match
   * * `joinFields`: An object with the joinfields to retrieve
   * * `aggregations`: An object with the aggregations to retrieve
   * * `orderBy`: A string with the name of the field to order by
   * * `orderDesc`: If true, descending order
   * * `limit`: A number with the maximum number of rows to retrieve
   * * `offset`: The number of rows to skip in the result before returning rows
   *
   * @example
   * ```
   * const patients = Table.findOne({ name: "patients" });
   * const patients_rows = await patients.getJoinedRows({
   *      where: { age: { gt: 65 } },
   *      orderBy: "id",
   *      aggregations: {
   *        avg_temp: {
   *          table: "readings",
   *          ref: "patient_id",
   *          field: "temperature",
   *          aggregate: "avg",
   *       },
   *      },
   *      joinFields: {
   *        pages: { ref: "favbook", target: "pages" },
   *        author: { ref: "favbook", target: "author" },
   *      },
   * });
   * ```
   *
   * @param {object} [opts = {}]
   * @returns {Promise<object[]>}
   */
  async getJoinedRows(
    opts: (JoinOptions & ForUserRequest) | any = {}
  ): Promise<Array<Row>> {
    const fields = this.fields;
    const { forUser, forPublic, ...selopts1 } = opts;
    const role = forUser ? forUser.role_id : forPublic ? 100 : null;
    const { sql, values, notAuthorized, joinFields } =
      await this.getJoinedQuery(opts);

    if (notAuthorized) return [];
    const res = await db.query(sql, values);
    if (res.length === 0) return res; // check

    let calcRow = apply_calculated_fields(
      res.rows,
      fields,
      !!opts?.ignore_errors
    );

    //rename joinfields
    if (Object.values(joinFields || {}).some((jf: any) => jf.rename_object)) {
      let f = (x: any) => x;
      Object.entries(joinFields || {}).forEach(([k, v]: any) => {
        if (v.rename_object) {
          if (v.rename_object.length === 2) {
            const oldf = f;
            f = (x: any) => {
              const origId = x[v.rename_object[0]];
              x[v.rename_object[0]] = {
                ...x[v.rename_object[0]],
                [v.rename_object[1]]: x[k],
                ...(typeof origId === "number" ? { id: origId } : {}),
              };
              return oldf(x);
            };
          } else if (v.rename_object.length === 3) {
            const oldf = f;
            f = (x: any) => {
              const origId = x[v.rename_object[0]];
              x[v.rename_object[0]] = {
                ...x[v.rename_object[0]],
                [v.rename_object[1]]: {
                  ...x[v.rename_object[0]]?.[v.rename_object[1]],
                  [v.rename_object[2]]: x[k],
                },
                ...(typeof origId === "number" ? { id: origId } : {}),
              };
              return oldf(x);
            };
          } else if (v.rename_object.length === 4) {
            const oldf = f;
            f = (x: any) => {
              const origId = x[v.rename_object[0]];

              x[v.rename_object[0]] = {
                ...x[v.rename_object[0]],
                [v.rename_object[1]]: {
                  ...x[v.rename_object[0]]?.[v.rename_object[1]],
                  [v.rename_object[2]]: {
                    ...x[v.rename_object[0]]?.[v.rename_object[1]]?.[
                      v.rename_object[2]
                    ],
                    [v.rename_object[3]]: x[k],
                  },
                },
                ...(typeof origId === "number" ? { id: origId } : {}),
              };

              return oldf(x);
            };
          }
        }
      });

      calcRow = calcRow.map(f);
    }

    if (role && role > this.min_role_read) {
      //check ownership
      if (forPublic) return [];
      else if (this.ownership_field_id) {
        //already dealt with by changing where
      } else if (this.ownership_formula || this.name === "users") {
        calcRow = calcRow.filter((row: Row) => this.is_owner(forUser, row));
      } else return []; //no ownership
    }
    return calcRow;
  }

  /**
   *
   */
  async slug_options(): Promise<Array<{ label: string; steps: any }>> {
    const fields = this.fields;
    const unique_fields = fields.filter((f) => f.is_unique);
    const opts: Array<{ label: string; steps: any }> = [];
    unique_fields.forEach((f: Field) => {
      const label =
        instanceOfType(f.type) && f.type.name === "String"
          ? `/slugify-${f.name}`
          : `/:${f.name}`;
      opts.push({
        label,
        steps: [
          {
            field: f.name,
            unique: true,
            transform:
              instanceOfType(f.type) && f.type.name === "String"
                ? "slugify"
                : null,
          },
        ],
      });
    });
    opts.unshift({ label: "", steps: [] });
    return opts;
  }

  /**
   *
   */
  static async allSlugOptions(): Promise<{
    [nm: string]: Array<{ label: string; steps: any }>;
  }> {
    const tables = await Table.find({}, { cached: true });
    const options: {
      [nm: string]: Array<{ label: string; steps: any }>;
    } = {};
    for (const table of tables) {
      options[table.name] = await table.slug_options();
    }
    return options;
  }

  /**
   *
   */
  async getTags(): Promise<Array<AbstractTag>> {
    const Tag = (await import("./tag")).default;
    return await Tag.findWithEntries({ table_id: this.id });
  }

  /**
   *
   */
  async getForeignTables(): Promise<Array<AbstractTable>> {
    const result = new Array<AbstractTable>();
    if (this.fields) {
      for (const field of this.fields) {
        if (field.is_fkey) {
          const refTable = Table.findOne({ name: field.reftable_name! });
          if (refTable) result.push(refTable);
        }
      }
    }
    return result;
  }

  getFormulaExamples(typename: string) {
    return get_formula_examples(
      typename,
      this.fields.filter((f) => !f.calculated)
    );
  }
}

// declaration merging
namespace Table {
  export type ParentRelations = {
    parent_relations: {
      key_field: Field;
      table?: Table;
      ontable?: Table;
    }[];
    parent_field_list: string[];
  };

  export type ChildRelations = {
    child_relations: {
      key_field: Field;
      table: Table;
    }[];
    child_field_list: string[];
  };

  export type RelationData = {
    relationTable: Table;
    relationField: Field;
  };
}

type ParentRelations = Table.ParentRelations;
type ChildRelations = Table.ChildRelations;
type RelationData = Table.RelationData;

export = Table;
