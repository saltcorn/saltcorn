/**
 * TableConstraint Database Access Layer
 * @category saltcorn-data
 * @module models/table_constraints
 * @subcategory models
 */
import type { Where, SelectOptions } from "@saltcorn/db-common/internal";
import db from "../db";
import type Field from "./field";
const { stringToJSON } = require("../utils");
import type Table from "./table";

/**
 * TableConstraint class
 * @category saltcorn-data
 */
class TableConstraint {
  table_id?: number;
  type: TypeOption;
  id?: number | null;
  configuration: any;

  /**
   * @param {object} o
   */
  constructor(o: TableConstraintCfg) {
    if (!o.table_id && !o.table)
      throw new Error(`Please specify ether 'table._id' or 'table'.`);
    if (o.table_id) this.table_id = +o.table_id;
    if (o.table) {
      this.table_id = o.table.id;
    }
    this.type = o.type;
    this.id = !o.id ? null : +o.id;
    this.configuration = stringToJSON(o.configuration) || {};
  }

  /**
   * @type {object}
   */
  get toJson(): { type: TypeOption; configuration: any } {
    return {
      type: this.type,
      configuration: this.configuration,
    };
  }

  /**
   * @param {*} where
   * @param {*} selectopts
   * @returns {Promise<TableConstraint[]>}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Array<TableConstraint>> {
    const db_flds = await db.select("_sc_table_constraints", where, selectopts);
    return db_flds.map((dbf: TableConstraintCfg) => new TableConstraint(dbf));
  }

  /**
   * @param {*} where
   * @returns {Promise<TableConstraint>}
   */
  static async findOne(where: Where): Promise<TableConstraint | null> {
    const p = await db.selectMaybeOne("_sc_table_constraints", where);
    return p ? new TableConstraint(p) : null;
  }

  /**
   * @param {*} f
   * @returns {Promise<TableConstraint>}
   */
  static async create(f: TableConstraintCfg): Promise<TableConstraint> {
    const con = new TableConstraint(f);
    const { id, ...rest } = con;
    const fid = await db.insert("_sc_table_constraints", rest);
    con.id = fid;
    if (con.type === "Unique" && con.configuration.fields) {
      const Table = require("./table");
      const table = await Table.findOne({ id: con.table_id });
      await db.add_unique_constraint(table.name, con.configuration.fields);
    }

    return con;
  }

  /**
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    await db.deleteWhere("_sc_table_constraints", { id: this.id });
    if (this.type === "Unique" && this.configuration.fields) {
      const Table = require("./table");
      const table = await Table.findOne({ id: this.table_id });
      await db.drop_unique_constraint(table.name, this.configuration.fields);
    }
  }

  /**
   * @param {*} table
   * @param {*} field
   * @returns {Promise<void>}
   */
  static async delete_field_constraints(
    table: Table,
    field: Field
  ): Promise<void> {
    const tblcs = await TableConstraint.find({ table_id: table.id });
    for (const c of tblcs) {
      if (c.configuration.fields && c.configuration.fields.includes(field.name))
        await c.delete();
    }
  }

  /**
   * @type {string[]}
   */
  static get type_options(): Array<TypeOption> {
    return [...type_options];
  }
}

// type union from array with const assertion
const type_options = ["Unique"] as const;
type TypeOption = typeof type_options[number];

namespace TableConstraint {
  export type TableConstraintCfg = {
    table_id?: number | string;
    table?: Table;
    id?: number;
    configuration?: string | any;
    type: TypeOption;
  };
}
type TableConstraintCfg = TableConstraint.TableConstraintCfg;

export = TableConstraint;
