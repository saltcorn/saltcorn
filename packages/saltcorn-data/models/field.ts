/**
 * Field Data Access Layer
 * @category saltcorn-data
 * @module models/field
 * @subcategory models
 */

import db from "../db";
const {
  recalculate_for_stored,
  jsexprToWhere,
  eval_expression,
  freeVariables,
} = require("./expression");
import { sqlsanitize } from "@saltcorn/db-common/internal";
const { InvalidAdminAction, isNode } = require("../utils");
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type {
  ErrorMessage,
  GenObj,
  ResultMessage,
  Type,
} from "@saltcorn/types/common_types";
import { instanceOfType } from "@saltcorn/types/common_types";
import type Table from "./table";
import type {
  FieldCfg,
  AbstractField,
  InputType,
} from "@saltcorn/types/model-abstracts/abstract_field";
import { AbstractTable } from "@saltcorn/types/model-abstracts/abstract_table";
//import { fileSync } from "tmp-promise";
import File from "./file";

const readKey = (v: any, field: Field): string | null | ErrorMessage => {
  if (v === "") return null;
  if (typeof v === "string" && v.startsWith("Preset:")) return v;
  const { getState } = require("../db/state");
  if (!field.reftype)
    throw new Error("Unable to find the type, 'reftype' is undefined.");
  const type =
    getState().types[
      typeof field.reftype === "string" ? field.reftype : field.reftype.name
    ];
  const parsed = type.read(v);
  return parsed || (v ? { error: "Unable to read key" } : null);
};

/**
 * Field Class
 * @category saltcorn-data
 */
class Field implements AbstractField {
  label: string;
  name: string;
  fieldview?: string;
  validator: (arg0: any) => boolean | string | undefined;
  showIf?: any;
  parent_field?: string;
  postText?: string;
  class: string;
  id?: number;
  default?: string;
  sublabel?: string;
  description?: string;
  type?: string | Type;
  typename?: string;
  options?: any;
  required: boolean;
  is_unique: boolean;
  hidden: boolean;
  disabled: boolean;
  calculated: boolean;
  primary_key: boolean;
  stored: boolean;
  expression?: string;
  sourceURL?: string;
  is_fkey: boolean;
  input_type: InputType;
  reftable_name?: string;
  tab?: string;
  reftype?: string | Type;
  refname: string = "";
  reftable?: AbstractTable;
  attributes: GenObj;
  table_id?: number;
  table?: AbstractTable | null;

  // to use 'this[k] = v'
  [key: string]: any;

  /**
   * Constructor
   * @param o
   */
  constructor(o: FieldCfg | Field) {
    if (!o.name && !o.label)
      throw new Error(`Field initialised with no name and no label`);
    this.label = <string>(o.label || o.name);
    this.name = <string>(o.name || Field.labelToName(this.label));
    if (!o.type && !o.input_type)
      throw new Error(`Field ${o.name} initialised with no type`);
    this.fieldview = o.fieldview;
    this.validator = o.validator || (() => true);
    this.showIf = o.showIf;
    this.parent_field = o.parent_field;
    this.postText = o.postText;
    this.class = o.class || "";
    this.id = o.id;
    this.default = o.default;
    this.sublabel = o.sublabel;
    this.description = o.description;
    const { getState } = require("../db/state");

    this.type = typeof o.type === "string" ? getState().types[o.type] : o.type;
    if (!this.type)
      this.typename = typeof o.type === "string" ? o.type : o.type?.name;
    this.options = o.options;
    this.required = !!o.required;
    this.is_unique = !!o.is_unique;
    this.hidden = o.hidden || false;
    this.disabled = !!o.disabled;
    this.calculated = !!o.calculated;
    this.primary_key = !!o.primary_key;
    this.stored = !!o.stored;
    this.expression = o.expression;
    this.sourceURL = o.sourceURL;
    this.tab = o.tab;

    this.is_fkey =
      o.type === "Key" ||
      (typeof o.type === "string" && o.type.startsWith("Key to"));

    if (o.type === "File") {
      this.type = "File";
      this.input_type = this.fieldview ? "fromtype" : "file";
    } else if (!this.is_fkey) {
      this.input_type = o.input_type || "fromtype";
    } else {
      this.reftable_name = o.reftable_name || (o.reftable && o.reftable.name);
      if (o.type && typeof o.type === "string" && o.type.startsWith("Key to "))
        this.reftable_name = o.type.replace("Key to ", "");
      this.reftable = o.reftable;
      this.type = "Key";
      this.input_type =
        !this.fieldview || this.fieldview === "select" ? "select" : "fromtype";
      this.reftype = o.reftype || "Integer";
      this.refname = o.refname || "id";
    }

    this.attributes =
      typeof o.attributes === "string"
        ? JSON.parse(o.attributes)
        : o.attributes || {};
    if (o.table_id) this.table_id = o.table_id;

    if (o.table) {
      this.table = o.table;
      if (o.table.id && !o.table_id) this.table_id = o.table.id;
    }
  }

  /**
   * To Json
   * @type {object}
   */
  get toJson(): any {
    return {
      id: this.id,
      table_id: this.table_id,
      name: this.name,
      label: this.label,
      is_unique: this.is_unique,
      calculated: this.calculated,
      stored: this.stored,
      expression: this.expression,
      sublabel: this.sublabel,
      fieldview: this.fieldview,
      type: typeof this.type === "string" ? this.type : this.type?.name,
      reftable_name: this.reftable_name,
      attributes: this.attributes,
      required: this.required,
      primary_key: this.primary_key,
      reftype: this.reftype,
      refname: this.refname,
      description: this.description, //
    };
  }

  /**
   * Label 2 Name
   * @param {string} label
   * @returns {string}
   */
  // todo from internalization point of view better to separate label, name. sqlname
  // because label can contain characters that cannot be used in PG for sql names
  static labelToName(label: string): string {
    return sqlsanitize(label.toLowerCase().split(" ").join("_"));
  }

  get type_name(): string | undefined {
    if (typeof this.type === "string") return this.type;
    else if (this.type?.name) return this.type.name;
    else if (this.typename) return this.typename;
  }

  /**
   * ???
   * @returns {string}
   */
  get form_name(): string {
    if (this.parent_field) return `${this.parent_field}_${this.name}`;
    else return this.name;
  }

  static async select_options_query(
    table_name: string,
    where: string,
    attributes: any
  ) {
    const Table = require("./table");
    const label_formula = attributes?.label_formula;
    const joinFields = {};

    const table = Table.findOne(table_name);
    if (!table) {
      return await db.select(table_name, where);
    }
    if (label_formula) {
      const { add_free_variables_to_joinfields } = require("../plugin-helper");
      const fields = await table.getFields();
      add_free_variables_to_joinfields(
        freeVariables(label_formula),
        joinFields,
        fields
      );
    }

    return await table.getJoinedRows({ where, joinFields });
  }

  /**
   * Fills 'this.options' with values available via foreign key
   * Could be used for <options /> in a <select/> to select a user
   * @param [force_allow_none = false]
   * @param where0
   * @param extraCtx
   * @param optionsQuery remote/local query to load rows from 'reftable_name'
   * @param formFieldNames
   * @returns
   */
  async fill_fkey_options(
    force_allow_none: boolean = false,
    where0?: Where,
    extraCtx: any = {},
    optionsQuery?: any,
    formFieldNames?: string[]
  ): Promise<void> {
    let where = where0;

    if (
      !where &&
      this.attributes.where &&
      this.is_fkey &&
      this.type !== "File"
    ) {
      const Table = require("./table");
      const refTable = Table.findOne(this.reftable_name);
      const relFields = await refTable.getFields();
      where = jsexprToWhere(this.attributes.where, extraCtx, relFields);
    } else if (!where)
      where = this.attributes.where
        ? jsexprToWhere(this.attributes.where, extraCtx)
        : undefined;
    const isDynamic = (formFieldNames || []).some((nm) =>
      (this.attributes.where || "").includes("$" + nm)
    );
    if (isDynamic) {
      const fakeEnv: any = {};
      formFieldNames!.forEach((nm) => {
        fakeEnv[nm] = "$" + nm;
      });
      this.attributes.dynamic_where = {
        table: this.reftable_name,
        refname: this.refname,
        where: this.attributes.where,
        whereParsed: jsexprToWhere(this.attributes.where, fakeEnv),
        summary_field: this.attributes.summary_field,
        label_formula: this.attributes.label_formula,
        required: this.required,
      };
    }
    //console.log({ where, isDynamic, awhere: this.attributes.where });

    if (
      this.is_fkey &&
      this.fieldview === "two_level_select" &&
      this.attributes.relation
    ) {
      const Table = require("./table");
      const refTable = Table.findOne(this.reftable_name);
      const relFields = await refTable.getFields();
      const relField = relFields.find(
        (f: any) => f.name === this.attributes.relation
      );

      const rows = await refTable.getJoinedRows({
        joinFields: {
          first_level: {
            ref: this.attributes.relation,
            target: relField.attributes.summary_field,
          },
        },
      });
      this.options = {};
      rows.forEach((row: any) => {
        const opt = {
          label: row[this.attributes.summary_field],
          value: row[this.refname],
        };
        if (!this.options[row.first_level])
          this.options[row.first_level] = {
            id: row[this.attributes.relation],
            options: [opt],
          };
        else this.options[row.first_level].options.push(opt);
      });
      //console.log(this.options);
    } else if (this.is_fkey) {
      if (!this.attributes) this.attributes = {};
      if (!this.attributes.select_file_where)
        this.attributes.select_file_where = {};

      const rows = !optionsQuery
        ? await Field.select_options_query(
            this.reftable_name as string,
            this.type === "File" ? this.attributes.select_file_where : where,
            this.attributes
          )
        : await optionsQuery(
            this.reftable_name,
            this.type,
            this.attributes,
            where
          );
      const summary_field =
        this.attributes.summary_field ||
        (this.type === "File" ? "filename" : "id");
      const get_label = this.attributes?.label_formula
        ? (r: Row) => {
            try {
              return eval_expression(this.attributes?.label_formula, r);
            } catch (error: any) {
              error.message = `Error in formula ${this.attributes?.label_formula} for select label:\n${error.message}`;
              throw error;
            }
          }
        : (r: Row) => r[summary_field];
      const dbOpts = rows.map((r: Row) => ({
        label: get_label(r),
        value: r[this.refname],
      }));
      const allOpts =
        !this.required || force_allow_none
          ? [{ label: "", value: "" }, ...dbOpts]
          : dbOpts;
      this.options = [...new Set(allOpts)];
    } else if (this.type === "File") {
      const files = await File.find(
        this.attributes.folder
          ? { folder: this.attributes.folder }
          : this.attributes.select_file_where || {}
      );
      this.options = files
        .filter((f) => !f.isDirectory)
        .map((f) => ({
          label: f.filename,
          value: f.path_to_serve,
        }));
      if (!this.required) this.options.unshift({ label: "", value: "" });
    }
  }

  /**
   * Distinct Values
   * @param {object} [req]
   * @param where
   * @returns {Promise<void>}
   */
  async distinct_values(
    req?: any,
    where?: Where
  ): Promise<{ label: string; value: string; jsvalue?: boolean }[]> {
    const __ = req && req.__ ? req.__ : (s: string) => s;
    if (
      instanceOfType(this.type) &&
      this.type.name === "String" &&
      this.attributes &&
      this.attributes.options
    ) {
      return [
        { label: "", value: "" },
        ...this.attributes.options
          .split(",")
          .map((o: string) => ({ label: o.trim(), value: o.trim() })),
      ];
    }
    if (this.is_fkey) {
      await this.fill_fkey_options(false, where);
      return this.options || [];
    }
    if (instanceOfType(this.type) && this.type.name === "Bool") {
      return [
        { label: "", value: "" },
        { label: __("True"), value: "on", jsvalue: true },
        { label: __("False"), value: "off", jsvalue: false },
      ];
    }
    this.fill_table();
    let whereS = "";
    let values = [];
    if (where) {
      const whereValues = db.mkWhere(where);
      whereS = whereValues.where;
      values = whereValues.values;
    }
    const { rows } = await db.query(
      `select distinct "${db.sqlsanitize(this.name)}" from ${
        this.table?.sql_name
      } ${whereS} order by "${db.sqlsanitize(this.name)}"`,
      values
    );
    const dbOpts = rows.map((r: Row) => ({
      label: `${r[this.name]}`,
      value: r[this.name],
    }));
    return [{ label: "", value: "" }, ...dbOpts];
  }
  /**
   * @type {string}
   */
  get on_delete_sql(): string {
    return this.attributes?.on_delete === "Cascade"
      ? " on delete cascade"
      : this.attributes?.on_delete === "Set null"
      ? " on delete set null"
      : this.attributes?.on_delete_cascade //legacy
      ? " on delete cascade"
      : "";
  }
  /**
   * @type {string}
   */
  get sql_type(): string {
    if (this.is_fkey) {
      this.fill_table();

      if (!this.reftype || !this.reftable_name) {
        throw new Error(
          "'reftype' and 'reftable_name' must be set if 'is_fkey' is true."
        );
      }
      const schema = db.getTenantSchemaPrefix();
      const { getState } = require("../db/state");
      const on_delete = this.on_delete_sql;

      return `${
        getState().types[
          typeof this.reftype === "string" ? this.reftype : this.reftype.name
        ].sql_name
      } constraint "${sqlsanitize(this!.table!.name)}_${sqlsanitize(
        this.name
      )}_fkey" references ${schema}"${sqlsanitize(this.reftable_name)}" ("${
        this.refname
      }")${on_delete}`;
    } else if (this.type === "File") {
      return "text";
    } else if (this.type && instanceOfType(this.type) && this.type.sql_name) {
      return this.type.sql_name;
    }
    throw new Error(
      "Unable to get the sql_type" + JSON.stringify(this.type, null, 2)
    );
  }

  /**
   * @type {string}
   */
  get pretty_type(): string {
    if (this.reftable_name === "_sc_files") return "File";
    if (this.is_fkey) return `Key to ${this.reftable_name}`;
    else return this.type && instanceOfType(this.type) ? this.type.name : "?";
  }

  /**
   * @type {string}
   */
  get sql_bare_type(): string {
    if (this.is_fkey) {
      if (!this.reftype || !this.reftable_name) {
        throw new Error(
          "'reftype' and 'reftable_name' must be set if 'is_fkey' is true."
        );
      }
      const { getState } = require("../db/state");
      return getState().types[
        typeof this.reftype === "string" ? this.reftype : this.reftype.name
      ].sql_name;
    } else if (this.type && instanceOfType(this.type) && this.type.sql_name) {
      return this.type.sql_name;
    } else if (this.type === "File") {
      return "text";
    }
    throw new Error("Unable to get the sql_type");
  }

  /**
   * @returns {Promise<any>}
   */
  async generate(): Promise<any> {
    if (this.is_fkey) {
      const rows = await db.select(
        this.reftable_name,
        {},
        { limit: 1, orderBy: "RANDOM()" }
      );
      if (rows.length === 1) return rows[0].id;
    } else {
      if (instanceOfType(this.type) && this.type.contract)
        return this.type.contract(this.attributes).generate();
    }
  }

  /**
   * @param {object} whole_rec
   * @returns {object}
   */

  showIfEnabled(whole_rec: any) {
    if (!this.showIf) return true;
    for (const [k, v] of Object.entries(this.showIf)) {
      if (Array.isArray(v) && !v.includes(whole_rec[k])) return false;
      if (typeof v === "boolean" && !whole_rec[k]) return false;
      if (whole_rec[k] !== v) return false;
    }
    return true;
  }

  get multipartFormData() {
    if (this.input_type === "file") return true;
    if (this.type !== "File") return false;
    const { getState } = require("../db/state");
    if (!this.fieldview) return false;
    const fileview = getState().fileviews[this.fieldview];
    return !!fileview?.multipartFormData;
  }

  validate(whole_rec: any): ResultMessage {
    const type = this.is_fkey ? { name: "Key" } : this.type;
    let readval = null;
    let typeObj = this.type as Type;
    let fvObj = this.fieldview && typeObj?.fieldviews?.[this.fieldview];
    if (this.is_fkey) {
      readval = readKey(whole_rec[this.form_name], this);
    } else {
      if (fvObj?.readFromFormRecord) {
        readval = fvObj.readFromFormRecord(whole_rec, this.form_name);
      } else if (fvObj?.read) {
        readval = fvObj.read(whole_rec[this.form_name], this.attributes);
      } else {
        readval =
          !type || (!typeObj.read && !typeObj.readFromFormRecord)
            ? whole_rec[this.form_name]
            : typeObj.readFromFormRecord
            ? typeObj.readFromFormRecord(whole_rec, this.form_name)
            : (typeObj as any).read(whole_rec[this.form_name], this.attributes);
      }
    }
    if (typeof readval === "undefined" || readval === null)
      if (this.required && this.type !== "File") {
        if (this.showIfEnabled(whole_rec))
          return { error: "Unable to read " + (<Type>type)?.name };
        return { success: null };
      } else return { success: null };
    const tyvalres =
      instanceOfType(type) && type.validate
        ? type.validate(this.attributes || {})(readval)
        : readval;
    if (tyvalres.error) return tyvalres;
    const fvalres = this.validator(readval);
    if (typeof fvalres === "string") return { error: fvalres };
    if (typeof fvalres === "undefined" || fvalres) return { success: readval };
    else return { error: "Not accepted" };
  }

  /**
   *
   * @param {object} where
   * @param {object} [selectopts]
   * @returns {Field[]}
   */
  static async find(
    where?: Where,
    selectopts: SelectOptions = { orderBy: "name", nocase: true }
  ): Promise<Field[]> {
    const db_flds = await db.select("_sc_fields", where, selectopts);
    return db_flds.map((dbf: FieldCfg) => new Field(dbf));
  }

  /**
   * @param {object} where
   * @returns {Promise<Field>}
   */
  static async findOne(where: Where): Promise<Field> {
    const db_fld = await db.selectOne("_sc_fields", where);
    return new Field(db_fld);
  }

  /**
   * @returns {Promise<void>}
   */
  async add_unique_constraint(): Promise<void> {
    this.fill_table();
    await db.add_unique_constraint(this.table?.name, [this.name]);
  }

  /**
   * @returns {Promise<void>}
   */
  async remove_unique_constraint(): Promise<void> {
    this.fill_table();
    await db.drop_unique_constraint(this.table?.name, [this.name]);
  }

  /**
   *
   * @param {boolean} not_null
   * @returns {Promise<void>}
   */
  async toggle_not_null(not_null: boolean): Promise<void> {
    this.fill_table();

    if (!this.table) {
      throw new Error("To toggle a not null constraint, 'table' must be set.");
    }
    const schema = db.getTenantSchemaPrefix();
    await db.query(
      `alter table ${schema}"${sqlsanitize(
        this.table.name
      )}" alter column "${sqlsanitize(this.name)}" ${
        not_null ? "set" : "drop"
      } not null;`
    );
    await require("../db/state").getState().refresh_tables();
  }

  /**
   * @param {object} new_field
   * @returns {Promise<void>}
   */
  async alter_sql_type(new_field: Field) {
    let new_sql_type = new_field.sql_type;
    let def = "";
    let using = `USING ("${sqlsanitize(this.name)}"::${
      new_field.sql_bare_type
    })`;

    const schema = db.getTenantSchemaPrefix();
    this.fill_table();
    if (!this.table) {
      throw new Error(
        `To add the field '${new_field.name}', 'table' must be set.`
      );
    }
    if (new_field.primary_key) {
      await db.query(
        `ALTER TABLE ${schema}"${sqlsanitize(
          this.table.name
        )}" drop column "${sqlsanitize(this.name)}";`
      );

      if (instanceOfType(new_field.type)) {
        if (new_field.type.primaryKey?.sql_type)
          new_sql_type = new_field.type.primaryKey.sql_type;
        if (new_field.type.primaryKey?.default_sql) {
          def = `default ${new_field.type.primaryKey.default_sql}`;
        }
      }
      await db.query(
        `ALTER TABLE ${schema}"${sqlsanitize(
          this.table.name
        )}" add column "${sqlsanitize(
          this.name
        )}" ${new_sql_type} primary key ${def};`
      );
    } else if (
      new_field.is_fkey &&
      this.reftable_name &&
      new_field.reftable_name &&
      (new_field.on_delete_sql !== this.on_delete_sql ||
        new_field.reftable_name !== this.reftable_name)
    ) {
      //add or remove on delete cascade - https://stackoverflow.com/a/10356720

      await db.query(
        `ALTER TABLE ${schema}"${sqlsanitize(
          this.table.name
        )}" drop constraint "${sqlsanitize(this.table.name)}_${sqlsanitize(
          this.name
        )}_fkey", add constraint "${sqlsanitize(
          new_field!.table!.name
        )}_${sqlsanitize(new_field.name)}_fkey" foreign key ("${sqlsanitize(
          new_field.name
        )}") references ${schema}"${sqlsanitize(
          new_field!.reftable_name
        )}"(id)${new_field.on_delete_sql}`
      );
    } else
      await db.query(
        `alter table ${schema}"${sqlsanitize(
          this.table.name
        )}" alter column "${sqlsanitize(
          this.name
        )}" TYPE ${new_sql_type} ${using} ${def};`
      );
    await require("../db/state").getState().refresh_tables();
  }

  /**
   * @returns {Promise<void>}
   */
  fill_table(): void {
    if (!this.table) {
      const Table = require("./table");
      this.table = Table.findOne({ id: this.table_id });
    }
  }

  /**
   * @param {object} v
   * @returns {Promise<void>}
   */
  async update(v: Row): Promise<void> {
    const f = new Field({ ...this, ...v });
    const state = require("../db/state").getState();
    const rename: boolean = f.name !== this.name;
    if (rename && !this.table?.name) {
      throw new Error("");
    }

    if (
      typeof v.is_unique !== "undefined" &&
      !!v.is_unique !== !!this.is_unique
    ) {
      if (v.is_unique && !this.is_unique) await this.add_unique_constraint();
      if (!v.is_unique && this.is_unique) await this.remove_unique_constraint();
      await db.update("_sc_fields", { is_unique: v.is_unique }, this.id);
    }

    if (typeof v.required !== "undefined" && !!v.required !== !!this.required)
      await this.toggle_not_null(!!v.required);

    if (
      f.sql_type !== this.sql_type ||
      this.reftable_name !== f.reftable_name
    ) {
      await this.alter_sql_type(f);
    }
    if (rename) {
      const schema = db.getTenantSchemaPrefix();

      await db.query(
        `alter table ${schema}"${sqlsanitize(
          this.table!.name // ensured above
        )}" rename column "${sqlsanitize(this.name)}" TO ${f.name};`
      );
    }
    await db.update("_sc_fields", v, this.id);

    Object.entries(v).forEach(([k, v]: [string, any]) => {
      if (k !== "type") this[k] = v;
    });
    if (
      v.type &&
      v.type !== (typeof this.type === "string" ? this.type : this.type?.name)
    ) {
      if (state.types[v.type]) {
        this.type = state.types[v.type];
      }
    }

    await state.refresh_tables();
  }

  /**
   * @type {string}
   */
  get listKey(): any {
    if (instanceOfType(this.type))
      if (this.type.listAs)
        return (r: any) => (<Type>this.type).listAs!(r[this.name]);
      else if (this.type.showAs)
        return (r: any) => (<Type>this.type).showAs!(r[this.name]);
    return this.name;
  }

  /**
   * @type {object}
   */
  get presets(): { LoggedIn: ({ user }: { user: any }) => boolean } | null {
    if (instanceOfType(this.type) && this.type.presets)
      return this.type.presets;

    if (this.type === "Key" && this.reftable_name === "users")
      return { LoggedIn: ({ user }) => user && user.id };

    return null;
  }

  /**
   * @throws {InvalidAdminAction}
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    const Table = require("./table");
    const table = await Table.findOne({ id: this.table_id });
    const TableConstraint = require("./table_constraints");
    await TableConstraint.delete_field_constraints(table, this);
    if (table.ownership_field_id === this.id) {
      throw new InvalidAdminAction(
        `Cannot delete field ${this.name} as it sets ownership for table ${table.name}`
      );
    }

    const schema = db.getTenantSchemaPrefix();
    const client = db.isSQLite ? db : await db.getClient();
    await client.query("BEGIN");

    await db.deleteWhere("_sc_fields", { id: this.id }, { client });

    if (!db.isSQLite && (!this.calculated || this.stored)) {
      await client.query(
        `alter table ${schema}"${sqlsanitize(
          table.name
        )}" drop column "${sqlsanitize(this.name)}"`
      );
      if (table.versioned) {
        await client.query(
          `alter table ${schema}"${sqlsanitize(
            table.name
          )}__history" drop column "${sqlsanitize(this.name)}"`
        );
      }
    }
    await client.query("COMMIT");

    if (!db.isSQLite) await client.release(true);
    await require("../db/state").getState().refresh_tables();
  }

  /**
   * @param {object} table
   * @returns {Promise<void>}
   */
  async enable_fkey_constraint(table: Table) {
    if (this.is_fkey && !db.isSQLite) {
      if (!this.reftable_name) {
        throw new Error(
          "To enable a foreign key constraint, the 'reftable_name' must be set."
        );
      }
      const schema = db.getTenantSchemaPrefix();

      const q = `alter table ${schema}"${sqlsanitize(
        table.name
      )}" ADD CONSTRAINT "${sqlsanitize(table.name)}_${sqlsanitize(
        this.name
      )}_fkey" FOREIGN KEY ("${sqlsanitize(
        this.name
      )}") references ${schema}"${sqlsanitize(this.reftable_name)}" (id)${
        this.attributes?.on_delete_cascade ? " on delete cascade" : ""
      }`;
      await db.query(q);
    }
  }

  /**
   * @param fld
   * @param bare
   * @param id - optional id, if set, no '_sc_fields' entry is inserted
   * @returns
   */
  static async create(
    fld: Field | FieldCfg,
    bare: boolean = false,
    id?: string
  ): Promise<Field> {
    const f = new Field(fld);
    const schema = db.getTenantSchemaPrefix();

    const Table = require("./table");
    const is_sqlite = db.isSQLite;
    //const tables = await Table.find();
    //console.log({ tables, fld });
    if (f.is_fkey) {
      //need to check ref types
      const reftable = await Table.findOne({ name: f.reftable_name });
      if (reftable) {
        const reffields = await reftable.getFields();
        const refpk = reffields.find((rf: Field) => rf.primary_key);
        f.reftype = refpk.type.name;
        f.refname = refpk.name;
      }
    }

    const sql_type = bare ? f.sql_bare_type : f.sql_type;
    const table = await Table.findOne({ id: f.table_id });
    if (!f.calculated || f.stored) {
      if (typeof f.attributes.default === "undefined") {
        const q = `alter table ${schema}"${sqlsanitize(
          table.name
        )}" add column "${sqlsanitize(f.name)}" ${sql_type} ${
          f.required ? `not null ${is_sqlite ? 'default ""' : ""}` : ""
        }`;
        await db.query(q);
      } else if (is_sqlite) {
        //warning: not safe but for sqlite we don't care
        const q = `alter table ${schema}"${sqlsanitize(
          table.name
        )}" add column "${sqlsanitize(f.name)}" ${sql_type} ${
          f.required
            ? `not null default ${JSON.stringify(f.attributes.default)}`
            : ""
        }`;
        await db.query(q);
      } else {
        const q = `DROP FUNCTION IF EXISTS add_field_${sqlsanitize(f.name)};
      CREATE FUNCTION add_field_${sqlsanitize(f.name)}(thedef ${
          f.sql_bare_type
        }) RETURNS void AS $$
      BEGIN
      EXECUTE format('alter table ${schema}"${sqlsanitize(
          table.name
        )}" add column "${sqlsanitize(f.name)}" ${sql_type} ${
          f.required ? "not null" : ""
        } default %L', thedef);
      END;
      $$ LANGUAGE plpgsql;`;
        await db.query(q);
        await db.query(`SELECT add_field_${sqlsanitize(f.name)}($1)`, [
          f.attributes.default,
        ]);
      }
    }
    f.id = id
      ? id
      : await db.insert("_sc_fields", {
          table_id: f.table_id,
          name: f.name,
          label: f.label,
          type: f.is_fkey || f.type === "File" ? f.type : (<Type>f.type)?.name,
          reftable_name: f.is_fkey ? f.reftable_name : undefined,
          reftype: f.is_fkey ? f.reftype : undefined,
          refname: f.is_fkey ? f.refname : undefined,
          required: f.required,
          is_unique: f.is_unique,
          attributes: f.attributes,
          calculated: f.calculated,
          expression: f.expression,
          stored: f.stored,
          description: f.description,
        });
    await require("../db/state").getState().refresh_tables();

    if (isNode() && table.versioned && !(f.calculated && !f.stored)) {
      await db.query(
        `alter table ${schema}"${sqlsanitize(
          table.name
        )}__history" add column "${sqlsanitize(f.name)}" ${f.sql_bare_type}`
      );
    }

    if (f.is_unique && !f.calculated) await f.add_unique_constraint();

    if (f.calculated && f.stored) {
      const nrows = await table.countRows({});
      if (nrows > 0) {
        const table1 = await Table.findOne({ id: f.table_id });

        //intentionally omit await
        recalculate_for_stored(table1); //not waiting as there could be a lot of data
      }
    }
    if (fld.table && fld.table.fields) {
      fld.table.fields.push(f);
    }
    return f;
  }

  /**
   * @param {function|object[]} [typeattribs]
   * @param {number} [table_id]
   * @returns {*}
   */
  static getTypeAttributes(typeattribs: Function | any, table_id?: number) {
    const Table = require("./table");

    if (!typeattribs) return [];
    if (typeof typeattribs === "function") {
      if (!table_id) return typeattribs({});
      const table = Table.findOne({ id: table_id });
      return typeattribs({ table });
    } else return typeattribs;
  }
}

export = Field;
