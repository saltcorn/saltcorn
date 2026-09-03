/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_page_group_member
 * @subcategory model-abstracts
 */

/** One eligible page within an AbstractPageGroup (model-abstracts/abstract_page_group). */
export interface AbstractPageGroupMember {
  id?: number;
  description?: string;
  page_group_id: number;
  page_id: number;
  sequence: number;
  eligible_formula: string;
}

/** Configuration for creating/updating an {@link AbstractPageGroupMember}. */
export type PageGroupMemberCfg = {
  id?: number;
  description?: string;
  page_group_id?: number;
  page_id: number;
  sequence?: number; // remove or move to pack ??
  eligible_formula: string;
};

/** A portable (import/export) representation of a {@link PageGroupMemberCfg}. */
export type PageGroupMemberPack = {
  page_name: string;
} & Omit<PageGroupMemberCfg, "page_id" | "page_group_id">;
