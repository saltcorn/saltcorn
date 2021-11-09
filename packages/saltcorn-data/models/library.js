/**
 * Library Database Access Layer
 * @category saltcorn-data
 * @module models/library
 * @subcategory models
 */
const db = require("../db");
const { contract, is } = require("contractis");
const { traverseSync } = require("./layout");

/**
 * Library Class
 * @category saltcorn-data
 */
class Library {
  /**
   * Library constructor
   * @param {object} o 
   */
  constructor(o) {
    this.id = o.id;
    this.name = o.name;
    this.icon = o.icon;
    this.layout =
      typeof o.layout === "string" ? JSON.parse(o.layout) : o.layout;
  }

  /**
   * @param {object} lib_in 
   */
  static async create(lib_in) {
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
  get toJson() {
    const { id, ...rest } = this;
    return rest;
  }

  /**
   * @param {*} where 
   * @param {*} selectopts 
   * @returns {Library[]}
   */
  static async find(where, selectopts) {
    const us = await db.select("_sc_library", where, selectopts);
    return us.map((u) => new Library(u));
  }

  /**
   * @param {*} where 
   * @returns {Library}
   */
  static async findOne(where) {
    const u = await db.selectMaybeOne("_sc_library", where);
    return u ? new Library(u) : u;
  }

  /**
   * @param {*} what 
   * @returns {object}
   */
  suitableFor(what) {
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
  async delete() {
    const schema = db.getTenantSchemaPrefix();
    await db.query(`delete FROM ${schema}_sc_library WHERE id = $1`, [this.id]);
  }

  /**
   * @param {*} row
   * @returns {Promise<void>}
   */
  async update(row) {
    await db.update("_sc_library", row, this.id);
  }
}

module.exports = Library;
