import type {
  AbstractPageGroupMember,
  PageGroupMemberPack,
} from "./abstract_page_group_member";

export interface AbstractPageGroup {
  id?: number;
  name: string;
  description?: string;
  members: Array<AbstractPageGroupMember>;
  min_role: number;
  random_allocation: boolean;
}

export type PageGroupCfg = {
  id?: number;
  name: string;
  description?: string;
  min_role?: number;
  random_allocation?: boolean;
  members?: Array<AbstractPageGroupMember>;
};

export type PageGroupPack = {
  members: PageGroupMemberPack[];
} & Omit<PageGroupCfg, "members">;
