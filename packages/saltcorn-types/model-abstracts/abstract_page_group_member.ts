export interface AbstractPageGroupMember {
  id?: number;
  description?: string;
  page_group_id: number;
  page_id: number;
  sequence: number;
  eligible_formula: string;
}

export type PageGroupMemberCfg = {
  id?: number;
  description?: string;
  page_group_id?: number;
  page_id: number;
  sequence?: number; // remove or move to pack ??
  eligible_formula: string;
};

export type PageGroupMemberPack = {
  page_name: string;
} & Omit<PageGroupMemberCfg, "page_id" | "page_group_id">;
