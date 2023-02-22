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

import type { ResultMessage } from "@saltcorn/types/common_types";
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
  freeVariables,
  add_free_variables_to_joinfields,
  removeComments,
} = expression;

import csvtojson from "csvtojson";
import moment from "moment";
import { createReadStream } from "fs";
import { stat, readFile } from "fs/promises";
import utils from "../utils";
//import { num_between } from "@saltcorn/types/generators";
//import { devNull } from "os";
const {
  prefixFieldsInWhere,
  InvalidConfiguration,
  InvalidAdminAction,
  satisfies,
  structuredClone,
  getLines,
  mergeIntoWhere,
} = utils;

import type { AbstractTag } from "@saltcorn/types/model-abstracts/abstract_tag";
import type {
  JoinFieldOption,
  RelationOption,
} from "@saltcorn/types/base_types";

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
  fields: Field[];
  is_user_group: boolean;

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
    this.is_user_group = !!o.is_user_group;
    this.external = false;
    this.description = o.description;
    this.fields = o.fields.map((f) => new Field(f));
  }

  /**
   *
   * Find one Table
   *
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

    const flds = await db.select(
      "_sc_fields",
      db.isSQLite ? {} : { table_id: { in: tbls.map((t: TableCfg) => t.id) } },
      selectopts
    );

    return tbls.map((t: TableCfg) => {
      t.fields = flds
        .filter((f: any) => f.table_id === t.id)
        .map((f: any) => new Field(f));

      return new Table(t);
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
    // todo seems like hacking logic. needs redesign
    if (!field_name && this.name === "users")
      return user && user.id && row && `${row.id}` === `${user.id}`;

    return typeof field_name === "string" && row[field_name] === user.id;
  }

  async ownership_options(): Promise<{ label: string; value: string }[]> {
    const fields = await this.getFields();

    //start with userfields
    const opts: { label: string; value: string }[] = fields
      .filter((f) => f.reftable_name === "users")
      .map((f) => ({ value: `${f.id}`, label: f.name }));

    // inherit from all my fks if table has ownership
    for (const field of fields) {
      if (field.is_fkey && field.reftable_name) {
        const refTable = await Table.findOne({ name: field.reftable_name });

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
            value: `Fml:user.${ugtable.name}_by_${ug_to_user.name}.map(g=>g.${ug_to_me.name}).includes(${this.pk_name}) /* User group ${ugtable.name} */`,
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
   * Create table
   * @param name - table name
   * @param options - table fields
   * @param id - optional id, if set, no '_sc_tables' entry is inserted
   * @returns {Promise<Table>} table
   */
  static async create(
    name: string,
    options: SelectOptions | TablePack = {},
    id?: number
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
    let pk_fld_id;
    if (!id) {
      // insert table definition into _sc_tables
      id = await db.insert("_sc_tables", tblrow);
      // add primary key column ID
      const insfldres = await db.query(
        `insert into ${schema}_sc_fields(table_id, name, label, type, attributes, required, is_unique,primary_key)
            values($1,'id','ID','Integer', '{}', true, true, true) returning id`,
        [id]
      );
      pk_fld_id = insfldres.rows[0].id;
    }
    // create table

    const table = new Table({
      ...tblrow,
      id,
      fields: [
        new Field({
          type: "Integer",
          name: "id",
          label: "ID",
          primary_key: true,
          required: true,
          is_unique: true,
          table_id: id,
          id: pk_fld_id,
        }),
      ],
    });
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

  updateWhereWithOwnership(
    where: Where,
    fields: Field[],
    user?: Row
  ): { notAuthorized?: boolean } | undefined {
    const role = user?.role_id;

    if (
      role &&
      role > this.min_role_write &&
      ((!this.ownership_field_id && !this.ownership_formula) || role === 10)
    )
      return { notAuthorized: true };
    if (
      user &&
      role < 10 &&
      role > this.min_role_write &&
      this.ownership_field_id
    ) {
      const owner_field = fields.find((f) => f.id === this.ownership_field_id);
      if (!owner_field)
        throw new Error(`Owner field in table ${this.name} not found`);
      mergeIntoWhere(where, {
        [owner_field.name]: user.id,
      });
    }
  }

  /**
   * Delete rows from table
   * @param where - condition
   * @returns {Promise<void>}
   */
  async deleteRows(where: Where, user?: Row) {
    // get triggers on delete
    const triggers = await Trigger.getTableTriggers("Delete", this);
    const fields = await this.getFields();

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
    if (triggers.length > 0 || deleteFileFields.length > 0) {
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
      for (const deleteFile of deleteFileFields) {
        for (const row of rows) {
          if (row[deleteFile.name]) {
            const file = await File.findOne({ id: row[deleteFile.name] });
            deleteFiles.push(file);
          }
        }
      }
    }
    if (rows)
      await db.deleteWhere(this.name, {
        [this.pk_name]: { in: rows.map((r) => r[this.pk_name]) },
      });
    else await db.deleteWhere(this.name, where);
    await this.resetSequence();
    for (const file of deleteFiles) {
      await file.delete();
    }
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
   * @param selopts
   * @returns {Promise<null|*>}
   */
  async getRow(
    where: Where = {},
    selopts: SelectOptions & ForUserRequest = {}
  ): Promise<Row | null> {
    const fields = await this.getFields();
    const { forUser, forPublic, ...selopts1 } = selopts;
    const role = forUser ? forUser.role_id : forPublic ? 10 : null;
    const row = await db.selectMaybeOne(this.name, where, selopts1);
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
      } else if (this.ownership_formula) {
        if (!this.is_owner(forUser, row)) return null;
      } else return null; //no ownership
    }
    return apply_calculated_fields([this.readFromDB(row)], this.fields)[0];
  }

  /**
   * Get rows from Table in db
   * @param where
   * @param selopts
   * @returns {Promise<void>}
   */
  async getRows(
    where: Where = {},
    selopts: SelectOptions & ForUserRequest = {}
  ): Promise<Row[]> {
    const fields = await this.getFields();
    if (!this.fields) return [];
    const { forUser, forPublic, ...selopts1 } = selopts;
    const role = forUser ? forUser.role_id : forPublic ? 10 : null;
    if (
      role &&
      this.updateWhereWithOwnership(where, fields, forUser || { role_id: 10 })
        ?.notAuthorized
    ) {
      return [];
    }

    let rows = await db.select(this.name, where, selopts1);
    if (role && role > this.min_role_read) {
      //check ownership
      if (forPublic) return [];
      else if (this.ownership_field_id) {
        //already dealt with by changing where
      } else if (this.ownership_formula) {
        rows = rows.filter((row: Row) => this.is_owner(forUser, row));
      } else return []; //no ownership
    }

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

  storedExpressionJoinFields() {
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
   * Update row
   * @param v_in - colums with values to update
   * @param id - id value
   * @param _userid - user id
   * @param noTrigger
   * @param resultCollector
   * @returns {Promise<void>}
   */
  async updateRow(
    v_in: any,
    id: number,
    user?: Row,
    noTrigger?: boolean,
    resultCollector?: object
  ): Promise<string | void> {
    let existing;
    let v = { ...v_in };
    const fields = await this.getFields();
    const pk_name = this.pk_name;
    const role = user?.role_id;
    const state = require("../db/state").getState();
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

    if (user && role && role > this.min_role_write) {
      if (role === 10) return "Not authorized";
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
    if (fields.some((f: Field) => f.calculated && f.stored)) {
      //if any freevars are join fields, update row in db first
      const freeVarFKFields = new Set(
        Object.values(joinFields).map((jf: any) => jf.ref)
      );
      let need_to_update = Object.keys(v_in).some((k) =>
        freeVarFKFields.has(k)
      );

      if (need_to_update) {
        await db.update(this.name, v, id, { pk_name });
      }

      existing = await this.getJoinedRow({
        where: { [pk_name]: id },
        forUser: user,
        joinFields,
      });

      let calced = await apply_calculated_fields_stored(
        need_to_update ? existing : { ...existing, ...v_in },
        // @ts-ignore TODO ch throw ?
        this.fields
      );

      for (const f of fields)
        if (f.calculated && f.stored) v[f.name] = calced[f.name];
    }

    if (this.versioned) {
      const existing1 = await db.selectOne(this.name, { [pk_name]: id });
      if (!existing) existing = existing1;
      await db.insert(this.name + "__history", {
        ...existing1,
        ...v,
        [pk_name]: id,
        _version: {
          next_version_by_id: +id,
        },
        _time: new Date(),
        _userid: user?.id,
      });
    }
    await db.update(this.name, v, id, { pk_name });
    if (typeof existing === "undefined") {
      const triggers = await Trigger.getTableTriggers("Update", this);
      if (triggers.length > 0)
        existing = await db.selectOne(this.name, { [pk_name]: id });
    }
    const newRow = { ...existing, ...v, [pk_name]: id };
    if (!noTrigger) {
      const trigPromise = Trigger.runTableTriggers(
        "Update",
        this,
        newRow,
        resultCollector,
        role === 10 ? undefined : user
      );
      if (resultCollector) await trigPromise;
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
    const fields = await this.getFields();
    if (fields.some((f: Field) => f.calculated && f.stored)) {
      await this.updateRow({}, id, undefined, false);
    }

    const triggers = await Trigger.getTableTriggers("Update", this);
    if (triggers.length > 0) {
      const row = await this.getRow({ id });
      if (!row) throw new Error(`Unable to find row with id: ${id}`);
      for (const trigger of triggers) {
        trigger.run!(row);
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
   * @param resultCollector
   * @returns {Promise<*>}
   */
  async insertRow(
    v_in: Row,
    user?: Row,
    resultCollector?: object
  ): Promise<any> {
    const fields = await this.getFields();
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
    if (Object.keys(joinFields).length > 0) {
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

      let calced = await apply_calculated_fields_stored(existing[0], fields);
      v = { ...v_in };

      for (const f of fields)
        if (f.calculated && f.stored) v[f.name] = calced[f.name];
      await db.update(this.name, v, id, { pk_name });
    } else {
      v = await apply_calculated_fields_stored(v_in, fields);
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
      await db.insert(this.name + "__history", {
        ...v,
        [pk_name]: id,
        _version: {
          next_version_by_id: +id,
        },
        _userid: user?.id,
        _time: new Date(),
      });

    const trigPromise = Trigger.runTableTriggers(
      "Insert",
      this,
      { [pk_name]: id, ...v },
      resultCollector,
      user
    );
    if (resultCollector) await trigPromise;
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
      return { success: id };
    } catch (e: any) {
      return { error: normalise_error_message(e.message) };
    }
  }

  /**
   * Get Fields list for table
   * @returns {Promise<Field[]>}
   */
  getFields(): Field[] {
    return this.fields;
  }

  /**
   * Get a field, possibly by relation
   * @returns {Promise<Field | undefined>}
   */
  async getField(path: string): Promise<Field | undefined> {
    const fields = await this.getFields();
    if (path.includes("->")) {
      const joinPath = path.split(".");
      const tableName = joinPath[0];
      const joinTable = await Table.findOne({ name: tableName });
      if (!joinTable)
        throw new Error(`The table '${tableName}' does not exist.`);
      const joinedField = joinPath[1].split("->")[1];
      const fields = await joinTable.getFields();
      return fields.find((f) => f.name === joinedField);
    } else if (path.includes(".")) {
      const keypath = path.split(".");
      let field,
        theFields = fields;
      for (let i = 0; i < keypath.length; i++) {
        const refNm = keypath[i];
        field = theFields.find((f) => f.name === refNm);
        if (!field || !field.reftable_name) break;
        const table = await Table.findOne({ name: field.reftable_name });
        if (!table) break;
        theFields = await table.getFields();
      }
      return field;
    } else return fields.find((f) => f.name === path);
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
    // todo support uuid
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

    // start sql transaction
    await client.query("BEGIN");

    const readStream = createReadStream(filePath);

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
                  if (rowOk) {
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
                      if (existing)
                        await db.update(this.name, rec, rec[this.pk_name], {
                          pk_name,
                          client,
                        });
                      else
                        await db.insert(this.name, rec, {
                          noid: true,
                          client,
                          pk_name,
                        });
                    } else
                      await db.insert(this.name, rec, {
                        noid: true,
                        client,
                        pk_name,
                      });
                  } else rejects += 1;
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

    // stop sql transaction
    await client.query("COMMIT");

    if (!db.isSQLite) await client.release(true);
    // reset id sequence
    await this.resetSequence();
    // recalculate fields
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
    const file_rows = JSON.parse((await readFile(filePath)).toString());
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
   * get join-field-options joined from a field in this table
   * @param allow_double
   * @param allow_triple
   * @returns
   */
  async get_join_field_options(
    allow_double?: boolean,
    allow_triple?: boolean
  ): Promise<JoinFieldOption[]> {
    const fields = await this.getFields();
    const result = [];
    for (const f of fields) {
      if (f.is_fkey && f.type !== "File") {
        const table = await Table.findOne({ name: f.reftable_name });
        if (!table) throw new Error(`Unable to find table '${f.reftable_name}`);
        await table.getFields();
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
            const table1 = await Table.findOne({ name: pf.reftable_name });
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
  async get_relation_data(): Promise<RelationData[]> {
    const result = new Array<RelationData>();
    const o2o_rels = await Field.find({
      reftable_name: this.name,
      is_unique: true,
    });
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

  async field_options(
    nrecurse: number = 0,
    fieldWhere: (f: Field) => boolean = () => true,
    prefix: string = ""
  ): Promise<string[]> {
    const fields = await this.getFields();
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
    if (allow_join_aggregations) {
      const fields = await this.getFields();
      for (const f of fields) {
        if (f.is_fkey && f.type !== "File") {
          const refTable = await Table.findOne({ name: f.reftable_name });
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
   *
   * @param opts
   * @returns {Promise<{values, sql: string}>}
   */
  async getJoinedQuery(
    opts: (JoinOptions & ForUserRequest) | any = {}
  ): Promise<any> {
    const fields = await this.getFields();
    let fldNms = [];
    let joinq = "";
    let joinTables: string[] = [];
    let joinFields: JoinFields = opts.joinFields || {};
    let aggregations: any = opts.aggregations || {};
    const schema = db.getTenantSchemaPrefix();
    const { forUser, forPublic } = opts;
    const role = forUser ? forUser.role_id : forPublic ? 10 : null;
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

    let placeCounter = values.length;
    Object.entries<AggregationOptions>(aggregations).forEach(
      ([
        fldnm,
        { table, ref, field, where, aggregate, subselect, through },
      ]) => {
        let whereStr = "";
        if (where && !subselect) {
          const whereAndValues = mkWhere(where, db.isSQLite, placeCounter);
          // todo warning deprecated symbol substr is used
          whereStr = whereAndValues.where.substr(6); // remove "where "

          values.push(...whereAndValues.values);
          placeCounter += whereAndValues.values.length;
        }
        const aggTable = Table.findOne({ name: table });
        const aggField = aggTable?.fields?.find((f) => f.name === field);
        const ownField = through ? sqlsanitize(through) : this.pk_name;
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
          )}" = aggjoin.id where aggto."${sqlsanitize(ref)}"=a."${ownField}"${
            whereStr ? ` and ${whereStr}` : ""
          }) ${sqlsanitize(fldnm)}`;

          fldNms.push(newFld);
        } else if (
          aggregate.startsWith("Latest ") ||
          aggregate.startsWith("Earliest ")
        ) {
          const dateField = aggregate.split(" ")[1];
          const isLatest = aggregate.startsWith("Latest ");
          fldNms.push(
            `(select "${sqlsanitize(field)}" from ${schema}"${sqlsanitize(
              table
            )}" where "${dateField}"=(select ${
              isLatest ? `max` : `min`
            }("${dateField}") from ${schema}"${sqlsanitize(
              table
            )}" where "${sqlsanitize(ref)}"=a."${ownField}"${
              whereStr ? ` and ${whereStr}` : ""
            }) and "${sqlsanitize(ref)}"=a."${ownField}" limit 1) ${sqlsanitize(
              fldnm
            )}`
          );
        } else if (subselect)
          fldNms.push(
            `(select ${sqlsanitize(aggregate)}(${
              field ? `"${sqlsanitize(field)}"` : "*"
            }) from ${schema}"${sqlsanitize(table)}" where "${sqlsanitize(
              ref
            )}" in (select "${subselect.field}" from ${schema}"${
              subselect.table.name
            }" where "${subselect.whereField}"=a."${ownField}")) ${sqlsanitize(
              fldnm
            )}`
          );
        else
          fldNms.push(
            `(select ${sqlsanitize(aggregate)}(${
              field ? `"${sqlsanitize(field)}"` : "*"
            }) from ${schema}"${sqlsanitize(table)}" where "${sqlsanitize(
              ref
            )}"=a."${ownField}"${
              whereStr ? ` and ${whereStr}` : ""
            }) ${sqlsanitize(fldnm)}`
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
          : opts.orderBy.toLowerCase() === "random()"
          ? opts.orderBy
          : "a." + opts.orderBy),
      orderDesc: opts.orderDesc,
      offset: opts.offset,
    };

    const sql = `SELECT ${fldNms.join()} FROM ${schema}"${sqlsanitize(
      this.name
    )}" a ${joinq} ${where}  ${mkSelectOptions(selectopts)}`;

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
   * @param {object} [opts = {}]
   * @returns {Promise<object[]>}
   */
  async getJoinedRows(
    opts: (JoinOptions & ForUserRequest) | any = {}
  ): Promise<Array<Row>> {
    const fields = await this.getFields();
    const { forUser, forPublic, ...selopts1 } = opts;
    const role = forUser ? forUser.role_id : forPublic ? 10 : null;
    const { sql, values, notAuthorized, joinFields } =
      await this.getJoinedQuery(opts);

    if (notAuthorized) return [];
    const res = await db.query(sql, values);
    if (res.length === 0) return res; // check

    let calcRow = apply_calculated_fields(res.rows, fields);

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
      } else if (this.ownership_formula) {
        calcRow = calcRow.filter((row: Row) => this.is_owner(forUser, row));
      } else return []; //no ownership
    }
    return calcRow;
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

  async getTags(): Promise<Array<AbstractTag>> {
    const Tag = (await import("./tag")).default;
    return await Tag.findWithEntries({ table_id: this.id });
  }

  async getForeignTables(): Promise<Array<AbstractTable>> {
    const result = new Array<AbstractTable>();
    if (this.fields) {
      for (const field of this.fields) {
        if (field.is_fkey) {
          const refTable = await Table.findOne({ name: field.reftable_name! });
          if (refTable) result.push(refTable);
        }
      }
    }
    return result;
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
