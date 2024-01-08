import db from "../db";
import type {
  AbstractPageGroup,
  PageGroupCfg,
} from "@saltcorn/types/model-abstracts/abstract_page_group";
import { Row, SelectOptions, Where } from "@saltcorn/db-common/internal";
import type {
  AbstractPageGroupMember,
  PageGroupMemberCfg,
} from "@saltcorn/types/model-abstracts/abstract_page_group_member";
import utils from "../utils";
const { satisfies } = utils;
import type { ConnectedObjects } from "@saltcorn/types/base_types";
import PageGroupMember from "./page_group_member";
import Expression from "./expression";
const { eval_expression } = Expression;

class PageGroup implements AbstractPageGroup {
  id?: number;
  name: string;
  description?: string;
  members: Array<AbstractPageGroupMember>;
  min_role: number;
  constructor(cfg: PageGroupCfg) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.description = cfg.description;
    this.members = cfg.members
      ? cfg.members.map((m: AbstractPageGroupMember) => new PageGroupMember(m))
      : [];
    this.min_role = cfg.min_role || 100;
  }

  async getEligiblePage(data: EligiblePageParams) {
    const Page = (await import("./page")).default;
    const sorted = this.members.sort((a, b) => a.sequence - b.sequence);
    for (const member of sorted) {
      const res = eval_expression(member.eligible_formula, data);
      if (res === true) {
        const page = Page.findOne({ id: member.page_id });
        if (page) return page;
      }
    }
    return null;
  }

  async moveMember(member: AbstractPageGroupMember, mode: "Up" | "Down") {
    let transactionOpen = false;
    try {
      await db.begin();
      transactionOpen = true;
      const sorted = this.members.sort((a, b) => a.sequence - b.sequence);
      const idx = sorted.findIndex((m) => m.id === member.id);
      if (idx === -1) return;
      if (mode === "Up" && idx > 0) {
        const prev = sorted[idx - 1];
        const tmp = prev.sequence;
        await PageGroupMember.update(prev.id!, { sequence: member.sequence });
        await PageGroupMember.update(member.id!, { sequence: tmp });
      }
      if (mode === "Down" && idx < sorted.length - 1) {
        const next = sorted[idx + 1];
        const tmp = next.sequence;
        await PageGroupMember.update(next.id!, { sequence: member.sequence });
        await PageGroupMember.update(member.id!, { sequence: tmp });
      }
      await db.commit();
      await require("../db/state").getState().refresh_page_groups();
    } catch (e) {
      if (transactionOpen) await db.rollback();
      throw e;
    }
  }

  sortedMembers(): Array<AbstractPageGroupMember> {
    return this.members.sort((a, b) => a.sequence - b.sequence);
  }

  static async find(
    where?: Where,
    selectopts: SelectOptions = { orderBy: "name", nocase: true }
  ): Promise<PageGroup[]> {
    if (selectopts.cached) {
      const { getState } = require("../db/state");
      return getState()
        .page_groups.map((t: PageGroup) => new PageGroup(t))
        .filter(satisfies(where || {}));
    }
    const groupsDb = await db.select("_sc_page_groups", where, selectopts);
    const groupIds = groupsDb.map((g: PageGroupCfg) => g.id);
    const members = !db.isSQLite
      ? await db.select("_sc_page_group_members", {
          page_group_id: { in: groupIds },
        })
      : (await db.select("_sc_page_group_members")).filter(
          (m: PageGroupMember) => groupIds.includes(m.page_group_id)
        );
    const memberToGroup = members.reduce((acc: any, member: Row) => {
      acc[member.page_group_id] = acc[member.page_group_id] || [];
      acc[member.page_group_id].push(member);
      return acc;
    }, {});
    return groupsDb.map((dbGroup: PageGroupCfg) => {
      const members = (memberToGroup[dbGroup.id!] || []).map(
        (m: PageGroupMemberCfg) => new PageGroupMember(m)
      );
      dbGroup.members = members;
      return new PageGroup(dbGroup);
    });
  }

  static findOne(where: Where): PageGroup | null {
    const { getState } = require("../db/state");
    const p = getState().page_groups.find(
      where.id
        ? (t: PageGroup) => t.id === +where.id
        : where.name
        ? (t: PageGroup) => t.name === where.name
        : satisfies(where)
    );
    return p ? new PageGroup({ ...p }) : p;
  }

  static async create(
    cfg: PageGroupCfg,
    noTransaction?: boolean
  ): Promise<PageGroup> {
    const pageGroup = new PageGroup(cfg);
    const membersToCopy = pageGroup.members;
    pageGroup.members = [];
    const { id, members, ...rest } = pageGroup;
    let transactionOpen = false;
    try {
      if (!noTransaction) {
        await db.begin();
        transactionOpen = true;
      }
      const fid = await db.insert("_sc_page_groups", rest);
      pageGroup.id = fid;
      for (const member of membersToCopy) {
        await pageGroup.addMember({
          page_id: member.page_id,
          eligible_formula: member.eligible_formula,
          name: member.name,
          description: member.description,
        });
      }
      if (transactionOpen) await db.commit();
    } catch (e) {
      if (transactionOpen) await db.rollback();
      throw e;
    }
    await require("../db/state").getState().refresh_page_groups();
    return pageGroup;
  }

  static async update(id: number, row: Row): Promise<void> {
    await db.update("_sc_page_groups", row, id);
    await require("../db/state").getState().refresh_page_groups();
  }

  static async delete(where: Where | number): Promise<void> {
    try {
      await db.begin();
      if (typeof where === "number") {
        const id = where;
        await db.deleteWhere("_sc_page_group_members", { page_group_id: id });
        await db.deleteWhere("_sc_page_groups", { id });
      } else {
        const pageGroups = await PageGroup.find(where);
        if (pageGroups.length > 0) {
          const pageGroupIds = pageGroups.map((p) => p.id);
          if (!db.isSQLite)
            await db.deleteWhere("_sc_page_group_members", {
              page_group_id: { in: pageGroupIds },
            });
          else
            db.query(
              `DELETE FROM _sc_page_group_members WHERE page_group_id IN (${pageGroupIds.join(
                ","
              )})`
            );
          await db.deleteWhere("_sc_page_groups", where);
        }
      }
      await db.commit();
      await require("../db/state").getState().refresh_page_groups();
    } catch (e) {
      await db.rollback();
      throw e;
    }
  }

  async delete(): Promise<void> {
    if (!this.id) throw new Error("Page group must be saved before deleting");
    await PageGroup.delete({ id: this.id });
  }

  async clone(): Promise<PageGroup> {
    let transactionOpen = false;
    try {
      await db.begin();
      transactionOpen = true;
      const basename = this.name + " copy";
      let newname;
      for (let i = 0; i < 100; i++) {
        newname = i ? `${basename} (${i})` : basename;
        const existing = PageGroup.findOne({ name: newname });
        if (!existing) break;
      }
      const createObj = {
        ...this,
        name: newname,
      };
      delete createObj.id;
      const newGroup = await PageGroup.create(createObj, true);
      await db.commit();
      return newGroup;
    } catch (e) {
      if (transactionOpen) await db.rollback();
      throw e;
    }
  }

  async addMember(cfg: PageGroupMemberCfg): Promise<PageGroupMember> {
    const PageGroupMember = (await import("./page_group_member")).default;
    if (!this.id)
      throw new Error("Page group must be saved before adding members");
    const maxSeq =
      this.members?.length > 0
        ? Math.max(...this.members.map((m) => m.sequence))
        : 0;
    const newMember = await PageGroupMember.create(
      {
        page_group_id: this.id,
        page_id: cfg.page_id,
        sequence: maxSeq + 1,
        eligible_formula: cfg.eligible_formula,
        name: cfg.name,
        description: cfg.description,
      },
      true
    );
    this.members.push(newMember);
    await require("../db/state").getState().refresh_page_groups();
    return new PageGroupMember(newMember);
  }

  async removeMember(id: number): Promise<void> {
    const PageGroupMember = (await import("./page_group_member")).default;
    await PageGroupMember.delete(id, true);
    await require("../db/state").getState().refresh_page_groups();
  }

  findMember(where: any): Array<AbstractPageGroupMember> {
    const pred = PageGroupMember.findPred(where) || satisfies(where);
    return this.members.filter(pred);
  }

  // TODO
  connected_objects(): ConnectedObjects {
    return {};
  }
}

// declaration merging
namespace PageGroup {
  export type EligiblePageParams = {
    width: number;
    height: number;
    innerWidth: number;
    innerHeight: number;
  };
}

type EligiblePageParams = PageGroup.EligiblePageParams;

export = PageGroup;
