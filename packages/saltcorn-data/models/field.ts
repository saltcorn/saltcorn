/**
 * Field Data Access Layer
 * @category saltcorn-data
 * @module models/field
 * @subcategory models
 */

import db from "../db";
const { recalculate_for_stored, jsexprToWhere } = require("./expression");
import { sqlsanitize } from "@saltcorn/db-common/internal";
const { InvalidAdminAction } = require("../utils");
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
    this.required = o.required ? true : false;
    this.is_unique = o.is_unique ? true : false;
    this.hidden = o.hidden || false;
    this.disabled = !!o.disabled;
    this.calculated = !!o.calculated;
    this.primary_key = !!o.primary_key;
    this.stored = !!o.stored;
    this.expression = o.expression;
    this.sourceURL = o.sourceURL;

    this.is_fkey =
      o.type === "Key" ||
      o.type === "File" ||
      (typeof o.type === "string" && o.type.startsWith("Key to"));

    if (!this.is_fkey) {
      this.input_type = o.input_type || "fromtype";
    } else if (o.type === "File") {
      this.type = "File";
      this.input_type = "file";
      this.reftable_name = "_sc_files";
      this.reftype = "Integer";
      this.refname = "id";
    } else {
      this.reftable_name = o.reftable_name || (o.reftable && o.reftable.name);
      if (!this.reftable_name && o.type && typeof o.type === "string")
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
    return sqlsanitize(label.toLowerCase().replace(" ", "_"));
  }

  /**
   * ???
   * @returns {string}
   */
  get form_name(): string {
    if (this.parent_field) return `${this.parent_field}_${this.name}`;
    else return this.name;
  }

  /**
   * Fill fkey options???
   * @param {boolean} [force_allow_none = false]
   * @param {object} where
   * @returns {Promise<void>}
   */
  async fill_fkey_options(
    force_allow_none: boolean = false,
    where0?: Where,
    extraCtx: any = {}
  ): Promise<void> {
    const where =
      where0 ||
      (this.attributes.where
        ? jsexprToWhere(this.attributes.where, extraCtx)
        : undefined);
    //console.log(where);
    if (
      this.is_fkey &&
      (this.type !== "File" ||
        typeof this.attributes.select_file_where !== "undefined")
    ) {
      const rows = await db.select(
        this.reftable_name,
        this.type === "File" ? this.attributes.select_file_where : where
      );

      const summary_field =
        this.attributes.summary_field ||
        (this.type === "File" ? "filename" : "id");
      const dbOpts = rows.map((r: Row) => ({
        label: r[summary_field],
        value: r[this.refname],
      }));
      const allOpts =
        !this.required || force_allow_none
          ? [{ label: "", value: "" }, ...dbOpts]
          : dbOpts;
      this.options = [...new Set(allOpts)];
    }
  }

  /**
   * Distinct Values
   * @param {object} [req]
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
    await this.fill_table();
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
  get sql_type(): string {
    if (this.is_fkey) {
      if (!this.reftype || !this.reftable_name) {
        throw new Error(
          "'reftype' and 'reftable_name' must be set if 'is_fkey' is true."
        );
      }
      const schema = db.getTenantSchemaPrefix();
      const { getState } = require("../db/state");
      return `${
        getState().types[
          typeof this.reftype === "string" ? this.reftype : this.reftype.name
        ].sql_name
      } references ${schema}"${sqlsanitize(this.reftable_name)}" ("${
        this.refname
      }")`;
    } else if (this.type && instanceOfType(this.type) && this.type.sql_name) {
      return this.type.sql_name;
    }
    throw new Error("Unable to get the sql_type");
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
  validate(whole_rec: any): ResultMessage {
    const type = this.is_fkey ? { name: "Key" } : this.type;
    let readval = null;
    if (this.is_fkey) {
      readval = readKey(whole_rec[this.form_name], this);
    } else {
      let typeObj = this.type as Type;
      readval =
        !type || !typeObj.read
          ? whole_rec[this.form_name]
          : typeObj.readFromFormRecord
          ? typeObj.readFromFormRecord(whole_rec, this.form_name)
          : typeObj.read(whole_rec[this.form_name], this.attributes);
    }
    if (typeof readval === "undefined" || readval === null)
      if (this.required && this.type !== "File")
        return { error: "Unable to read " + (<Type>type)?.name };
      else return { success: null };
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
    await this.fill_table();
    await db.add_unique_constraint(this.table?.name, [this.name]);
  }

  /**
   * @returns {Promise<void>}
   */
  async remove_unique_constraint(): Promise<void> {
    await this.fill_table();
    await db.drop_unique_constraint(this.table?.name, [this.name]);
  }

  /**
   *
   * @param {boolean} not_null
   * @returns {Promise<void>}
   */
  async toggle_not_null(not_null: boolean): Promise<void> {
    if (!this.table) {
      throw new Error("To toogle a not null constraint, 'table' must be set.");
    }
    const schema = db.getTenantSchemaPrefix();
    await this.fill_table();
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
    if (!this.table) {
      throw new Error(
        `To add the field '${new_field.name}', 'table' must be set.`
      );
    }
    let new_sql_type = new_field.sql_type;
    let def = "";
    let using = `USING ("${sqlsanitize(this.name)}"::${new_sql_type})`;

    const schema = db.getTenantSchemaPrefix();
    await this.fill_table();
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
  async fill_table(): Promise<void> {
    if (!this.table) {
      const Table = require("./table");
      this.table = await Table.findOne({ id: this.table_id });
    }
  }

  /**
   * @param {object} v
   * @returns {Promise<void>}
   */
  async update(v: Row): Promise<void> {
    const f = new Field({ ...this, ...v });
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

    if (f.sql_type !== this.sql_type) {
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
      this[k] = v;
    });
    await require("../db/state").getState().refresh_tables();
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
      )}" ADD CONSTRAINT "fkey_${sqlsanitize(table.name)}_${sqlsanitize(
        this.name
      )}" FOREIGN KEY ("${sqlsanitize(
        this.name
      )}") references ${schema}"${sqlsanitize(this.reftable_name)}" (id)`;
      await db.query(q);
    }
  }

  /**
   * @param {object} fld
   * @param {boolean} [bare = false]
   * @returns {Promise<Field>}
   */
  static async create(
    fld: Field | FieldCfg,
    bare: boolean = false
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
        //warning: not safe but sqlite so we don't care
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
    f.id = await db.insert("_sc_fields", {
      table_id: f.table_id,
      name: f.name,
      label: f.label,
      type: f.is_fkey ? f.type : (<Type>f.type)?.name,
      reftable_name: f.is_fkey ? f.reftable_name : undefined,
      reftype: f.is_fkey ? f.reftype : undefined,
      refname: f.is_fkey ? f.refname : undefined,
      required: f.required,
      is_unique: f.is_unique,
      attributes: f.attributes,
      calculated: f.calculated,
      expression: f.expression,
      stored: f.stored,
    });
    await require("../db/state").getState().refresh_tables();

    if (table.versioned && !f.calculated) {
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

        recalculate_for_stored(table1); //not waiting as there could be a lot of data
      }
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
