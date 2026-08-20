/**
 * Library Database Access Layer
 * @category saltcorn-data
 * @module models/library
 * @subcategory models
 */
import { traverseSync, traverse } from "./layout.js";
import db from "../db/index.js";
import type { Where, SelectOptions, Row } from "@saltcorn/db-common/internal";
import type { LibraryCfg } from "@saltcorn/types/model-abstracts/abstract_library";
import { structuredClone } from "../utils.js";


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
   * Last write wins - no live push or conflict detection.
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
   * Swaps a {type: "library"} reference for its real content, so it renders
   * as if it had been part of the page all along.
   * @param segment
   * @param req
   * @param visitedIds - library ids seen so far on this branch, so a library
   *   that contains itself renders blank instead of looping forever
   * @returns {Promise<void>}
   */
  static async resolveSegment(
    segment: any,
    req: any,
    visitedIds: Set<number> = new Set()
  ): Promise<void> {
    const libId = segment.library_id;
    const slots = segment.slots;
    const lib = visitedIds.has(libId)
      ? null
      : await Library.findOne({ id: libId });
    if (!lib || !lib.layout) {
      Object.keys(segment).forEach((k) => delete segment[k]);
      segment.type = "blank";
      segment.contents = "";
      return;
    }
    const libLayout = lib.layout.layout ? lib.layout.layout : lib.layout;
    Object.keys(segment).forEach((k) => delete segment[k]);
    Object.assign(segment, structuredClone(libLayout));
    // fill each slot with its saved field pick or dropped-in content;
    // a slot with no saved entry renders blank
    traverseSync(segment, {
      "library-slot": (seg: any) => {
        const fill = (slots || []).find((s: any) => s.name === seg.name);
        Object.keys(seg).forEach((k) => delete seg[k]);
        if (!fill) {
          seg.type = "blank";
          seg.contents = "";
        } else if (fill.kind === "field") {
          seg.type = "field";
          seg.field_name = fill.field;
          seg.fieldview = fill.fieldview;
          seg.configuration = {};
        } else {
          Object.assign(
            seg,
            structuredClone(fill.contents || { type: "blank", contents: "" })
          );
        }
      },
    });
    const nextVisited = new Set(visitedIds).add(libId);
    await traverse(segment, {
      library: (seg: any) => Library.resolveSegment(seg, req, nextVisited),
    });
  }
}

export default Library;
