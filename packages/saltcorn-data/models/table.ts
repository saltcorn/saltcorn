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
} from "@saltcorn/db-common/internal";
import type {
  Where,
  SelectOptions,
  Row,
  JoinField,
  JoinOptions,
  AggregationOptions,
} from "@saltcorn/db-common/internal";

import Field from "./field";
import type {
  AbstractTable,
  TableCfg,
  TablePack,
} from "@saltcorn/types/model-abstracts/abstract_table";

import type { ResultMessage } from "@saltcorn/types/common_types";
import {
  instanceOfErrorMsg,
  instanceOfType,
} from "@saltcorn/types/common_types";

import Trigger from "./trigger";
const {
  apply_calculated_fields,
  apply_calculated_fields_stored,
  recalculate_for_stored,
  get_expression_function,
} = require("./expression");
import csvtojson from "csvtojson";
import moment from "moment";
import { createReadStream } from "fs";
import { stat, readFile } from "fs/promises";
import utils from "../utils";
import { num_between } from "@saltcorn/types/generators";
const { prefixFieldsInWhere } = utils;
const {
  InvalidConfiguration,
  InvalidAdminAction,
  satisfies,
  structuredClone,
  getLines,
} = require("../utils");
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
// todo resolve database specific
/**
 * Normalise specific error message according db specific
 * @param msg
 * @returns {string}
 */
// todo refactor
const normalise_error_message = (msg: string): string =>
  db.isSQLite
    ? msg.replace(
        /SQLITE_CONSTRAINT: UNIQUE constraint failed: (.*?)\.(.*?)/,
        "Duplicate value for unique field: $2"
      )
    : msg.replace(
        /duplicate key value violates unique constraint "(.*?)_(.*?)_unique"/,
        "Duplicate value for unique field: $2"
      );

/**
 * Table class
 * @category saltcorn-data
 */
class Table implements AbstractTable {
  name: string;
  id?: number;
  min_role_read: number;
  min_role_write: number;
  ownership_field_id?: string;
  ownership_formula?: string;
  versioned: boolean;
  external: boolean;
  description?: string;
  fields?: Field[] | null;

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
    this.external = false;
    this.description = o.description;
    if (o.fields) this.fields = o.fields.map((f) => new Field(f));
  }

  /**
   *
   * Find one Table
   * @param where - where condition
   * @returns {*|Table|null} table or null
   */
  static findOne(where: Where | Table): Table | null {
    if (
      where &&
      ((where.constructor && where.constructor.name === "Table") ||
        where.getRows)
    )
      return <Table>where;
    if (typeof where === "string") return Table.findOne({ name: where });
    if (typeof where === "number") return Table.findOne({ id: where });
    if (where.name) {
      const { getState } = require("../db/state");
      const extTable = getState().external_tables[where.name];
      if (extTable) return extTable;
    }
    const { getState } = require("../db/state");
    const tbl = getState().tables.find(
      where.id
        ? (v: TableCfg) => v.id === +where.id
        : where.name
        ? (v: TableCfg) => v.name === where.name
        : satisfies(where)
    );
    return tbl ? new Table(structuredClone(tbl)) : null;
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
      return getState().tables.map((t: TableCfg) => new Table(t));
    }
    const tbls = await db.select("_sc_tables", where, selectopts);

    return tbls.map((t: TableCfg) => new Table(t));
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
      dbs = tbls.map((t: TableCfg) => new Table(t));
    }
    return [...dbs, ...externals];
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

    if (this.ownership_formula) {
      const f = get_expression_function(this.ownership_formula, this.fields);
      return f(row, user);
    }
    const field_name = this.owner_fieldname();
    if (!field_name && this.name === "users")
      return user && user.id && row && `${row.id}` === `${user.id}`;

    return typeof field_name === "string" && row[field_name] === user.id;
  }

  /**
   * Create table
   * @param name - table name
   * @param options - table fields
   * @returns {Promise<Table>} table
   */
  static async create(
    name: string,
    options: SelectOptions | TablePack = {}
  ): Promise<Table> {
    const schema = db.getTenantSchemaPrefix();
    // create table in database
    await db.query(
      `create table ${schema}"${sqlsanitize(name)}" (id ${
        db.isSQLite ? "integer" : "serial"
      } primary key)`
    );
    // populate table definition row
    const tblrow: any = {
      name,
      versioned: options.versioned || false,
      min_role_read: options.min_role_read || 1,
      min_role_write: options.min_role_write || 1,
      ownership_field_id: options.ownership_field_id,
      ownership_formula: options.ownership_formula,
      description: options.description || "",
    };
    // insert table defintion into _sc_tables
    const id = await db.insert("_sc_tables", tblrow);
    // add primary key columnt ID
    await db.query(
      `insert into ${schema}_sc_fields(table_id, name, label, type, attributes, required, is_unique,primary_key)
          values($1,'id','ID','Integer', '{}', true, true, true)`,
      [id]
    );
    // create table

    const table = new Table({ ...tblrow, id });
    // create table history
    if (table.versioned) await table.create_history_table();
    // refresh tables cache
    await require("../db/state").getState().refresh_tables();

    return table;
  }

  /**
   * Drop current table
   * @returns {Promise<void>}
   */
  async delete(only_forget: boolean = false): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    const is_sqlite = db.isSQLite;
    await this.update({ ownership_field_id: null });
    const client = is_sqlite ? db : await db.getClient();
    await client.query(`BEGIN`);
    try {
      if (!only_forget)
        await client.query(
          `drop table if exists ${schema}"${sqlsanitize(this.name)}"`
        );
      await client.query(
        `delete FROM ${schema}_sc_fields WHERE table_id = $1`,
        [this.id]
      );

      await client.query(`delete FROM ${schema}_sc_tables WHERE id = $1`, [
        this.id,
      ]);
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
   * get Table SQL Name
   * @type {string}
   */
  get sql_name(): string {
    return `${db.getTenantSchemaPrefix()}"${sqlsanitize(this.name)}"`;
  }

  async resetSequence() {
    const fields = await this.getFields();
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
   * Delete rows from table
   * @param where - condition
   * @returns {Promise<void>}
   */
  async deleteRows(where: Where) {
    // get triggers on delete
    const triggers = await Trigger.getTableTriggers("Delete", this);
    if (triggers.length > 0) {
      const rows = await this.getRows(where);
      for (const trigger of triggers) {
        for (const row of rows) {
          // run triggers on delete
          await trigger.run!(row);
        }
      }
    }
    await db.deleteWhere(this.name, where);
    await this.resetSequence();
  }

  /**
   * Returns row with only fields that can be read from db (readFromDB flag)
   * @param row
   * @returns {*}
   */
  readFromDB(row: Row): any {
    if (this.fields) {
      for (const f of this.fields) {
        if (f.type && instanceOfType(f.type) && f.type.readFromDB)
          row[f.name] = f.type.readFromDB(row[f.name]);
      }
    }
    return row;
  }

  /**
   * Get one row from table in db
   * @param where
   * @returns {Promise<null|*>}
   */
  async getRow(where: Where = {}): Promise<Row | null> {
    await this.getFields();
    const row = await db.selectMaybeOne(this.name, where);
    if (!row) return null;
    return apply_calculated_fields([this.readFromDB(row)], this.fields)[0];
  }

  /**
   * Get rows from Table in db
   * @param where
   * @param selopts
   * @returns {Promise<void>}
   */
  async getRows(where: Where = {}, selopts?: SelectOptions): Promise<Row[]> {
    await this.getFields();
    const rows = await db.select(this.name, where, selopts);
    return apply_calculated_fields(
      rows.map((r: Row) => this.readFromDB(r)),
      this.fields
    );
  }

  /**
   * Count amount of rows in db table
   * @param where
   * @returns {Promise<number>}
   */
  async countRows(where?: Where): Promise<number> {
    return await db.count(this.name, where);
  }

  /**
   * Return distinct Values for column in table
   * ????
   * @param fieldnm
   * @returns {Promise<Object[]>}
   */
  async distinctValues(fieldnm: string): Promise<any[]> {
    const res = await db.query(
      `select distinct "${db.sqlsanitize(fieldnm)}" from ${this.sql_name}`
    );
    return res.rows.map((r: Row) => r[fieldnm]);
  }

  /**
   * Update row
   * @param v_in - colums with values to update
   * @param id - id value
   * @param _userid - user id
   * @returns {Promise<void>}
   */
  async updateRow(v_in: any, id: number, _userid?: number): Promise<void> {
    let existing;
    let v;
    const fields = await this.getFields();
    const pk_name = this.pk_name;
    if (fields.some((f: Field) => f.calculated && f.stored)) {
      existing = await db.selectOne(this.name, { [pk_name]: id });
      v = await apply_calculated_fields_stored(
        { ...existing, ...v_in },
        this.fields
      );
    } else v = v_in;
    if (this.versioned) {
      if (!existing)
        existing = await db.selectOne(this.name, { [pk_name]: id });
      await db.insert(this.name + "__history", {
        ...existing,
        ...v,
        [pk_name]: id,
        _version: {
          next_version_by_id: +id,
        },
        _time: new Date(),
        _userid,
      });
    }
    await db.update(this.name, v, id, { pk_name });
    if (typeof existing === "undefined") {
      const triggers = await Trigger.getTableTriggers("Update", this);
      if (triggers.length > 0)
        existing = await db.selectOne(this.name, { [pk_name]: id });
    }
    const newRow = { ...existing, ...v, [pk_name]: id };
    await Trigger.runTableTriggers("Update", this, newRow);
  }

  /**
   * Try to Update row
   * @param v
   * @param id
   * @param _userid
   * @returns {Promise<{error}|{success: boolean}>}
   */
  async tryUpdateRow(
    v: any,
    id: any,
    _userid?: number
  ): Promise<ResultMessage> {
    try {
      await this.updateRow(v, id, _userid);
      return { success: true };
    } catch (e: any) {
      return { error: normalise_error_message(e.message) };
    }
  }

  /**
   * ????
   * @param id
   * @param field_name
   * @returns {Promise<void>}
   */
  async toggleBool(id: any, field_name: string): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(
      `update ${schema}"${sqlsanitize(this.name)}" set "${sqlsanitize(
        field_name
      )}"=NOT coalesce("${sqlsanitize(field_name)}", false) where id=$1`,
      [id]
    );
    const triggers = await Trigger.getTableTriggers("Update", this);
    if (triggers.length > 0) {
      const row = await this.getRow({ id });
      if (!row) throw new Error(`Unable to find row with id: ${id}`);
      for (const trigger of triggers) {
        await trigger.run!(row);
      }
    }
  }

  /**
   * Get primary key field
   * @type {string}
   */
  get pk_name(): string {
    const pkField = this.fields?.find((f: Field) => f.primary_key)?.name;
    if (!pkField) {
      throw new Error("A primary key field is mandatory");
    }
    return pkField;
  }

  /**
   * Insert row
   * @param v_in
   * @param _userid
   * @returns {Promise<*>}
   */
  async insertRow(v_in: Row, _userid?: number): Promise<any> {
    await this.getFields();
    const v = await apply_calculated_fields_stored(v_in, this.fields);
    const pk_name = this.pk_name;
    const id = await db.insert(this.name, v, { pk_name });
    if (this.versioned)
      await db.insert(this.name + "__history", {
        ...v,
        [pk_name]: id,
        _version: 1,
        _userid,
        _time: new Date(),
      });
    Trigger.runTableTriggers("Insert", this, { [pk_name]: id, ...v });
    return id;
  }

  /**
   * Try to Insert row
   * @param v
   * @param _userid
   * @returns {Promise<{error}|{success: *}>}
   */
  async tryInsertRow(
    v: Row,
    _userid?: number
  ): Promise<{ error: string } | { success: any }> {
    try {
      const id = await this.insertRow(v, _userid);
      return { success: id };
    } catch (e: any) {
      return { error: normalise_error_message(e.message) };
    }
  }

  /**
   * Get Fields list for table
   * @returns {Promise<Field[]>}
   */
  async getFields(): Promise<Field[]> {
    if (!this.fields) {
      this.fields = await Field.find({ table_id: this.id }, { orderBy: "id" });
      for (let field of this.fields) {
        field.table = this;
      }
    }
    return this.fields;
  }

  /**
   * Create history table
   * @returns {Promise<void>}
   */
  // todo create function that returns history table name for table
  async create_history_table(): Promise<void> {
    const schemaPrefix = db.getTenantSchemaPrefix();

    const fields = await this.getFields();
    const flds = fields.map(
      (f: Field) => `,"${sqlsanitize(f.name)}" ${f.sql_bare_type}`
    );
    const pk = fields.find((f) => f.primary_key)?.name;
    if (!pk) {
      throw new Error("Unable to find a field with a primary key.");
    }

    // create history table
    await db.query(
      `create table ${schemaPrefix}"${sqlsanitize(this.name)}__history" (
          _version integer,
          _time timestamp,
          _userid integer
          ${flds.join("")}
          ,PRIMARY KEY("${pk}", _version)
          );`
    );
  }

  /**
   * Drop history table
   * @returns {Promise<void>}
   */
  async drop_history_table(): Promise<void> {
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
        [sqlsanitize(new_name), sqlsanitize(this.name)]
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
    const existing = await Table.findOne({ id: this.id });
    if (!existing) {
      throw new Error(`Unable to find table with id: ${this.id}`);
    }
    const { external, fields, ...upd_rec } = new_table_rec;
    await db.update("_sc_tables", upd_rec, this.id);
    await require("../db/state").getState().refresh_tables();

    const new_table = await Table.findOne({ id: this.id });
    if (!new_table) {
      throw new Error(`Unable to find table with id: ${this.id}`);
    } else {
      if (new_table.versioned && !existing.versioned) {
        await new_table.create_history_table();
      } else if (!new_table.versioned && existing.versioned) {
        await new_table.drop_history_table();
      }
      Object.assign(this, new_table_rec);
    }
  }

  /**
   * Get table history data
   * @param id
   * @returns {Promise<*>}
   */
  async get_history(id: number): Promise<Row[]> {
    return await db.select(
      `${sqlsanitize(this.name)}__history`,
      { id },
      { orderBy: "_version" }
    );
  }

  /**
   * Enable constraints
   * @returns {Promise<void>}
   */
  async enable_fkey_constraints(): Promise<void> {
    const fields = await this.getFields();
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
    try {
      const s = await getLines(filePath, 500);
      rows = await csvtojson().fromString(s); // todo agrument type unknown
    } catch (e) {
      return { error: `Error processing CSV file` };
    }
    const rowsTr = transposeObjects(rows);
    const table = await Table.create(name);
    for (const [k, vs] of Object.entries(rowsTr)) {
      const required = (<any[]>vs).every((v: any) => v !== "");
      const nonEmpties = (<any[]>vs).filter((v: any) => v !== "");
      const isBools = "true false yes no on off y n t f".split(" ");
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

      //can fail here if: non integer i d, duplicate headers, invalid name

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
   * Import CSV file to existing table
   * @param filePath
   * @param recalc_stored
   * @param skip_first_data_row
   * @returns {Promise<{error: string}|{success: string}>}
   */
  async import_csv_file(
    filePath: string,
    recalc_stored?: boolean,
    skip_first_data_row?: boolean
  ): Promise<ResultMessage> {
    let headers;
    const { readStateStrict } = require("../plugin-helper");
    try {
      const s = await getLines(filePath, 1);
      [headers] = await csvtojson({
        output: "csv",
        noheader: true,
      }).fromString(s); // todo agrument type unknown
    } catch (e) {
      return { error: `Error processing CSV file` };
    }
    const fields = (await this.getFields()).filter((f) => !f.calculated);
    const okHeaders: any = {};
    const pk_name = this.pk_name;
    const renames: any[] = [];

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
      } else if (f.required && !f.primary_key) {
        return { error: `Required field missing: ${f.label}` };
      }
    }

    const fieldNames = headers.map((hnm: any) => {
      if (okHeaders[hnm]) return okHeaders[hnm].name;
    });
    // also id
    if (headers.includes(`id`)) okHeaders.id = { type: "Integer" };

    const renamesInv: any = {};
    renames.forEach(({ from, to }) => {
      renamesInv[to] = from;
    });
    const colRe = new RegExp(
      `(${Object.keys(okHeaders)
        .map((k) => renamesInv[k] || k)
        .join("|")})`
    );

    let i = 1;
    let rejects = 0;
    const client = db.isSQLite ? db : await db.getClient();

    const stats = await stat(filePath);
    const fileSizeInMegabytes = stats.size / (1024 * 1024);

    await client.query("BEGIN");

    const readStream = createReadStream(filePath);

    try {
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
          csvtojson({
            includeColumns: colRe,
          })
            .fromStream(readStream)
            .subscribe(
              async (rec: any) => {
                i += 1;
                if (skip_first_data_row && i === 2) return;
                try {
                  renames.forEach(({ from, to }) => {
                    rec[to] = rec[from];
                    delete rec[from];
                  });

                  const rowOk = readStateStrict(rec, fields);
                  if (rowOk)
                    await db.insert(this.name, rec, {
                      noid: true,
                      client,
                      pk_name,
                    });
                  else rejects += 1;
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

    await client.query("COMMIT");

    if (!db.isSQLite) await client.release(true);
    await this.resetSequence();
    if (
      recalc_stored &&
      this.fields &&
      this.fields.some((f) => f.calculated && f.stored)
    ) {
      await recalculate_for_stored(this);
    }
    return {
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
    const file_rows = JSON.parse(await (await readFile(filePath)).toString());
    const fields = await this.getFields();
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
   * Get parent relations for table
   * @param allow_double
   * @returns {Promise<{parent_relations: object[], parent_field_list: object[]}>}
   */
  async get_parent_relations(
    allow_double?: boolean,
    allow_triple?: boolean
  ): Promise<ParentRelations> {
    const fields = await this.getFields();
    let parent_relations = [];
    let parent_field_list = [];
    for (const f of fields) {
      if (f.is_fkey && f.type !== "File") {
        const table = await Table.findOne({ name: f.reftable_name });
        if (!table) throw new Error(`Unable to find table '${f.reftable_name}`);
        await table.getFields();
        if (!table.fields)
          throw new Error(`The table '${f.reftable_name} has no fields.`);

        for (const pf of table.fields.filter(
          (f: Field) => !f.calculated || f.stored
        )) {
          parent_field_list.push(`${f.name}.${pf.name}`);
          if (pf.is_fkey && pf.type !== "File" && allow_double) {
            const table1 = await Table.findOne({ name: pf.reftable_name });
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
    const o2o_rels = await Field.find({
      reftable_name: this.name,
      is_unique: true,
    });
    for (const relation of o2o_rels) {
      const related_table = await Table.findOne({ id: relation.table_id });
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

  /**
   * Get child relations for table
   * @returns {Promise<{child_relations: object[], child_field_list: object[]}>}
   */
  async get_child_relations(): Promise<ChildRelations> {
    const cfields = await Field.find({ reftable_name: this.name });
    let child_relations = [];
    let child_field_list = [];
    for (const f of cfields) {
      if (f.is_fkey) {
        const table = await Table.findOne({ id: f.table_id });
        if (!table) {
          throw new Error(`Unable to find table with id: ${f.table_id}`);
        }
        child_field_list.push(`${table.name}.${f.name}`);
        await table.getFields();
        child_relations.push({ key_field: f, table });
      }
    }
    return { child_relations, child_field_list };
  }

  /**
   *
   * @param opts
   * @returns {Promise<{values, sql: string}>}
   */
  async getJoinedQuery(opts: JoinOptions | any = {}): Promise<any> {
    const fields = await this.getFields();
    let fldNms = [];
    let joinq = "";
    let joinTables: string[] = [];
    let joinFields: JoinField = opts.joinFields || {};
    let aggregations: any = opts.aggregations || {};
    const schema = db.getTenantSchemaPrefix();

    fields
      .filter((f) => f.type === "File")
      .forEach((f) => {
        joinFields[`${f.name}__filename`] = {
          ref: f.name,
          reftable: "_sc_files",
          target: `filename`,
        };
      });
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
        for (const through1 of throughs) {
          const throughTable = await Table.findOne({
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
          )}_jt_${sqlsanitize(through1)}_jt_${sqlsanitize(ref)}`;

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
        fldNms.push(`${jtNm1}.${sqlsanitize(target)} as ${sqlsanitize(fldnm)}`);
      } else {
        fldNms.push(`${jtNm}.${sqlsanitize(target)} as ${sqlsanitize(fldnm)}`);
      }
    }
    for (const f of fields.filter((f) => !f.calculated || f.stored)) {
      fldNms.push(`a."${sqlsanitize(f.name)}"`);
    }
    const whereObj = prefixFieldsInWhere(opts.where, "a");
    const { where, values } = mkWhere(whereObj, db.isSQLite);

    let placeCounter = values.length;
    Object.entries<AggregationOptions>(aggregations).forEach(
      ([fldnm, { table, ref, field, where, aggregate, subselect }]) => {
        let whereStr = "";
        if (where && !subselect) {
          const whereAndValues = mkWhere(where, db.isSQLite, placeCounter);
          whereStr = whereAndValues.where.substr(6); // remove "where "

          values.push(...whereAndValues.values);
          placeCounter += whereAndValues.values.length;
        }
        const aggTable = Table.findOne({ name: table });
        const aggField = aggTable?.fields?.find((f) => f.name === field);
        if (
          aggField?.is_fkey &&
          aggField.attributes.summary_field &&
          aggregate.toLowerCase() === "array_agg"
        ) {
          const newFld = `(select array_agg(aggjoin."${sqlsanitize(
            aggField.attributes.summary_field
          )}") from ${schema}"${sqlsanitize(
            table
          )}" aggto join ${schema}"${sqlsanitize(
            aggField.reftable_name as string
          )}" aggjoin on aggto."${sqlsanitize(
            field
          )}" = aggjoin.id where aggto."${sqlsanitize(ref)}"=a.id${
            whereStr ? ` and ${whereStr}` : ""
          }) ${sqlsanitize(fldnm)}`;

          fldNms.push(newFld);
        } else if (aggregate.startsWith("Latest ")) {
          const dateField = aggregate.replace("Latest ", "");
          fldNms.push(
            `(select "${sqlsanitize(field)}" from ${schema}"${sqlsanitize(
              table
            )}" where ${dateField}=(select max(${dateField}) from ${schema}"${sqlsanitize(
              table
            )}" where "${sqlsanitize(ref)}"=a.id${
              whereStr ? ` and ${whereStr}` : ""
            }) and "${sqlsanitize(ref)}"=a.id) ${sqlsanitize(fldnm)}`
          );
        } else if (subselect)
          fldNms.push(
            `(select ${sqlsanitize(aggregate)}(${
              field ? `"${sqlsanitize(field)}"` : "*"
            }) from ${schema}"${sqlsanitize(table)}" where ${sqlsanitize(
              ref
            )} in (select "${subselect.field}" from ${schema}"${
              subselect.table.name
            }" where "${subselect.whereField}"=a.id)) ${sqlsanitize(fldnm)}`
          );
        else
          fldNms.push(
            `(select ${sqlsanitize(aggregate)}(${
              field ? `"${sqlsanitize(field)}"` : "*"
            }) from ${schema}"${sqlsanitize(table)}" where "${sqlsanitize(
              ref
            )}"=a.id${whereStr ? ` and ${whereStr}` : ""}) ${sqlsanitize(
              fldnm
            )}`
          );
      }
    );

    const selectopts: SelectOptions = {
      limit: opts.limit,
      orderBy:
        opts.orderBy &&
        (orderByIsObject(opts.orderBy)
          ? opts.orderBy
          : joinFields[opts.orderBy] || aggregations[opts.orderBy]
          ? opts.orderBy
          : "a." + opts.orderBy),
      orderDesc: opts.orderDesc,
      offset: opts.offset,
    };

    const sql = `SELECT ${fldNms.join()} FROM ${schema}"${sqlsanitize(
      this.name
    )}" a ${joinq} ${where}  ${mkSelectOptions(selectopts)}`;

    return { sql, values };
  }

  /**
   * @param {object} [opts = {}]
   * @returns {Promise<object[]>}
   */
  async getJoinedRows(opts: JoinOptions | any = {}): Promise<Array<Row>> {
    const fields = await this.getFields();

    const { sql, values } = await this.getJoinedQuery(opts);
    const res = await db.query(sql, values);
    //console.log(sql);
    //console.log(res.rows);

    const calcRow = apply_calculated_fields(res.rows, fields);

    //rename joinfields
    if (
      Object.values(opts.joinFields || {}).some((jf: any) => jf.rename_object)
    ) {
      let f = (x: any) => x;
      Object.entries(opts.joinFields || {}).forEach(([k, v]: any) => {
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

      return calcRow.map(f);
    } else return calcRow;
  }

  async slug_options(): Promise<Array<{ label: string; steps: any }>> {
    const fields = await this.getFields();
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

  static async allSlugOptions(): Promise<{
    [nm: string]: Array<{ label: string; steps: any }>;
  }> {
    const tables = await Table.find({});
    const options: {
      [nm: string]: Array<{ label: string; steps: any }>;
    } = {};
    for (const table of tables) {
      options[table.name] = await table.slug_options();
    }
    return options;
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
}

type ParentRelations = Table.ParentRelations;
type ChildRelations = Table.ChildRelations;

export = Table;
