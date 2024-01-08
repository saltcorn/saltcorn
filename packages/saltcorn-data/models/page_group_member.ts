import {
  AbstractPageGroupMember,
  PageGroupMemberCfg,
} from "@saltcorn/types/model-abstracts/abstract_page_group_member";
import { Row, SelectOptions, Where } from "@saltcorn/db-common/internal";
import db from "../db";
import type { ConnectedObjects } from "@saltcorn/types/base_types";
import utils from "../utils";
const { satisfies } = utils;

/**
 * PageGroupMember class
 */
class PageGroupMember implements AbstractPageGroupMember {
  id?: number;
  name?: string;
  description?: string;
  page_group_id: number;
  page_id: number;
  sequence: number;
  eligible_formula: string;
  constructor(cfg: PageGroupMemberCfg) {
    this.id = cfg.id;
    if (!cfg.page_group_id) throw new Error("page_group_id is required");
    this.page_group_id = cfg.page_group_id;
    this.page_id = cfg.page_id;
    this.sequence = cfg.sequence || 0;
    this.eligible_formula = cfg.eligible_formula;
    this.description = cfg.description;
    this.name = cfg.name;
  }

  /**
   * find members
   * @param where
   * @param selectopts
   * @returns an array of page group members
   */
  static async find(
    where?: Where,
    selectopts: SelectOptions = {}
  ): Promise<PageGroupMember[]> {
    if (selectopts.cached) {
      const { getState } = require("../db/state");
      const groups = getState().page_groups;
      const allMembers = [];
      for (const group of groups) {
        allMembers.push(...group.members);
      }
      return allMembers
        .map((m) => new PageGroupMember(m))
        .filter(satisfies(where || {}));
    } else {
      const db_flds = await db.select(
        "_sc_page_group_members",
        where,
        selectopts
      );
      return db_flds.map((dbf: PageGroupMember) => new PageGroupMember(dbf));
    }
  }

  static findOne(where: number | FindOneObj): PageGroupMember | null {
    const { getState } = require("../db/state");
    const groups = getState().page_groups;
    let pred = PageGroupMember.findPred(where);
    if (!pred) throw new Error("Invalid where");
    for (const group of groups) {
      const member = group.members.find(pred);
      if (member) return member;
    }
    return null;
  }

  /**
   * for internal use
   */
  static findPred(where: number | FindOneObj) {
    let pred = null;
    if (typeof where === "number" || typeof where === "string") {
      const searchId = +where;
      pred = (m: AbstractPageGroupMember) => m.id === searchId;
    } else if (instanceOfFindOneObj(where))
      pred = where.id
        ? (m: AbstractPageGroupMember) => m.id === +where.id!
        : where.page_group_id && where.sequence
        ? (m: AbstractPageGroupMember) =>
            m.page_group_id === where.page_group_id &&
            m.sequence === where.sequence
        : where.page_group_id && where.name
        ? (m: AbstractPageGroupMember) =>
            m.page_group_id === where.page_group_id && m.name === where.name
        : null;
    return pred;
  }

  /**
   * create a page group member
   * @param f
   * @param noRrefresh
   * @returns the created member
   */
  static async create(
    f: PageGroupMemberCfg,
    noRrefresh?: boolean
  ): Promise<PageGroupMember> {
    const pageGroupMember = new PageGroupMember(f);
    const { id, ...rest } = pageGroupMember;
    const fid = await db.insert("_sc_page_group_members", rest);
    pageGroupMember.id = fid;
    if (!noRrefresh)
      await require("../db/state").getState().refresh_page_groups();
    return pageGroupMember;
  }

  /**
   * update a page group member
   * @param id id of the member
   * @param row values to update
   * @param noRrefresh if true, the state won't reload
   */
  static async update(
    id: number,
    row: Row,
    noRrefresh?: boolean
  ): Promise<void> {
    await db.update("_sc_page_group_members", row, id);
    if (!noRrefresh)
      await require("../db/state").getState().refresh_page_groups();
  }

  /**
   * delete this page group member
   * @param noRrefresh if true, the state won't reload
   */
  async delete(noRrefresh?: boolean): Promise<void> {
    if (!this.id) throw new Error("Cannot delete page group member without id");
    await PageGroupMember.delete(this.id, noRrefresh);
  }

  /**
   * delete one page group member
   * @param id id of the member
   * @param noRrefresh if true, the state won't reload
   */
  static async delete(id: number, noRrefresh?: boolean): Promise<void> {
    await db.deleteWhere("_sc_page_group_members", { id });
    if (!noRrefresh)
      await require("../db/state").getState().refresh_page_groups();
  }

  /**
   * duplicate the member with a new name
   * @returns the create member
   */
  async clone(): Promise<PageGroupMember> {
    if (!this.name) throw new Error("Please give the member a name");
    else {
      let transactionOpen = false;
      try {
        await db.begin();
        transactionOpen = true;
        const basename = this.name + " copy";
        let newname;
        for (let i = 0; i < 100; i++) {
          newname = i ? `${basename} (${i})` : basename;
          const existing = PageGroupMember.findOne({
            page_group_id: this.page_group_id,
            name: newname,
          });
          if (!existing) break;
        }
        const createObj = {
          ...this,
          name: newname,
        };
        delete createObj.id;
        const PageGroup = (await import("./page_group")).default;
        const group = PageGroup.findOne({ id: this.page_group_id });
        if (!group)
          throw new Error(`Page ${this.page_group_id} group not found`);
        const newMember = await group.addMember(createObj);
        await db.commit();
        return newMember;
      } catch (e) {
        if (transactionOpen) await db.rollback();
        throw e;
      }
    }
  }

  connected_objects(): ConnectedObjects {
    return {};
  }
}

type FindOneObj = {
  page_group_id?: number;
  sequence?: number;
  id?: number | string;
  name?: string;
};

function instanceOfFindOneObj(object: any): object is FindOneObj {
  return (
    object &&
    typeof object !== "string" &&
    (("page_group_id" in object &&
      ("sequence" in object || "name" in object)) ||
      "id" in object)
  );
}

export = PageGroupMember;
