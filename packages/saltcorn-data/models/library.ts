/**
 * Library Database Access Layer
 * @category saltcorn-data
 * @module models/library
 * @subcategory models
 */
import { traverseSync } from "./layout.js";
import db from "../db/index.js";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { LibraryCfg } from "@saltcorn/types/model-abstracts/abstract_library";
import renderLayout from "@saltcorn/markup/layout";


/**
 * Library Class
 * @category saltcorn-data
 */
class Library {
  id?: number;
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
   * @returns {Promise<number>} id of the created library item
   */
  static async create(lib_in: LibraryCfg): Promise<number> {
    const lib = new Library(lib_in);
    return await db.insert("_sc_library", {
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
    let notPage, notShow, notEdit, notFilter, notList;
    if (!this.layout) return false;
    const layout = this.layout.layout ? this.layout.layout : this.layout;
    traverseSync(layout, {
      search_bar() {
        //eg: search - only page and filter
        notShow = true;
        notEdit = true;
        notList = true;
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
        notList = true;
      },
      field() {
        notPage = true;
      },
      view_link() {
        notFilter = true;
      },
      aggregation() {
        notEdit = true;
        notPage = true;
      },
      join_field() {
        notFilter = true;
        notPage = true;
      },
    });
    return {
      page: !notPage,
      show: !notShow,
      edit: !notEdit,
      filter: !notFilter,
      list: !notList,
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

  /**
   * Saves edits made inside a shared component back to its library row.
   * Last write wins - no conflict detection yet.
   * @param libraryUpdates
   * @returns {Promise<void>}
   */
  static async saveLibraryUpdates(
    libraryUpdates: { library_id: number; layout: any }[]
  ): Promise<void> {
    for (const u of libraryUpdates || []) {
      await db.update("_sc_library", { layout: u.layout }, { id: u.library_id });
    }
  }

  /**
   * Renders a shared component's current content in place of its
   * {type: "library"} reference, wherever a layout gets rendered.
   * @param segment
   * @param req
   * @returns {Promise<void>}
   */
  static async resolveSegment(segment: any, req: any): Promise<void> {
    const lib = await Library.findOne({ id: segment.library_id });
    segment.type = "blank";
    if (!lib) {
      segment.contents = "";
      return;
    }
    const libLayout = lib.layout.layout ? lib.layout.layout : lib.layout;
    segment.contents = renderLayout({
      blockDispatch: {},
      role: req?.user?.role_id || 100,
      req,
      layout: libLayout,
    });
  }
}

export default Library;
