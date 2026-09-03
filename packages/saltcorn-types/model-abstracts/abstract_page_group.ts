/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_page_group
 * @subcategory model-abstracts
 */
import type {
  AbstractPageGroupMember,
  PageGroupMemberPack,
} from "./abstract_page_group_member.js";

/** A group of pages randomly (or role-)allocated to visitors, e.g. for A/B testing. */
export interface AbstractPageGroup {
  id?: number;
  name: string;
  description?: string;
  members: Array<AbstractPageGroupMember>;
  min_role: number;
  random_allocation: boolean;
}

/** Configuration for creating/updating an {@link AbstractPageGroup}. */
export type PageGroupCfg = {
  id?: number;
  name: string;
  description?: string;
  min_role?: number;
  random_allocation?: boolean;
  members?: Array<AbstractPageGroupMember>;
};

/** A portable (import/export) representation of a {@link PageGroupCfg}. */
export type PageGroupPack = {
  members: PageGroupMemberPack[];
} & Omit<PageGroupCfg, "members">;
