/**
 * Library Database Access Layer
 * @category saltcorn-data
 * @module models/library
 * @subcategory models
 */
import db from "../db";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { LibraryCfg } from "@saltcorn/types/model-abstracts/abstract_library";

const { traverseSync } = require("./layout");

/**
 * Library Class
 * @category saltcorn-data
 */
class Library {
  id: number;
  name: string;
  icon: string;
  layout: any;

  /**
   * Library constructor
   * @param {object} o
   */
  constructor(o: LibraryCfg | Library) {
    this.id = o.id;
    this.name = o.name;
    this.icon = o.icon;
    this.layout =
      typeof o.layout === "string" ? JSON.parse(o.layout) : o.layout;
  }

  /**
   * @param {object} lib_in
   */
  static async create(lib_in: LibraryCfg): Promise<void> {
    const lib = new Library(lib_in);
    await db.insert("_sc_library", {
      name: lib.name,
      icon: lib.icon,
      layout: lib.layout,
    });
  }

  /**
   * @type {...*}
   */
  get toJson(): any {
    const { id, ...rest } = this;
    return rest;
  }

  /**
   * @param {*} where
   * @param {*} selectopts
   * @returns {Library[]}
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Library[]> {
    const us = await db.select("_sc_library", where, selectopts);
    return us.map((u: any) => new Library(u));
  }

  /**
   * @param {*} where
   * @returns {Library}
   */
  static async findOne(where: Where): Promise<Library> {
    const u = await db.selectMaybeOne("_sc_library", where);
    return u ? new Library(u) : u;
  }

  /**
   * @param {*} what
   * @returns {object}
   */
  suitableFor(what: string): any {
    let notPage, notShow, notEdit, notFilter;
    if (!this.layout) return false;
    const layout = this.layout.layout ? this.layout.layout : this.layout;
    traverseSync(layout, {
      search_bar() {
        //eg: search - only page and filter
        notShow = true;
        notEdit = true;
      },
      dropdown_filter() {
        notShow = true;
        notEdit = true;
        notPage = true;
      },
      toggle_filter() {
        notShow = true;
        notEdit = true;
        notPage = true;
      },
      field() {
        notFilter = true;
        notPage = true;
      },
      view_link() {
        notFilter = true;
        notEdit = true;
      },
      aggregation() {
        notFilter = true;
        notEdit = true;
        notPage = true;
      },
      join_field() {
        notFilter = true;
        notEdit = true;
        notPage = true;
      },
    });
    return {
      page: !notPage,
      show: !notShow,
      edit: !notEdit,
      filter: !notFilter,
    }[what];
  }

  /**
   * @returns {Promise<void>}
   */
  async delete(): Promise<void> {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_library WHERE id = $1`, [this.id]);
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  async update(row: Row): Promise<void> {
    await db.update("_sc_library", row, this.id);
  }
}

export = Library;
