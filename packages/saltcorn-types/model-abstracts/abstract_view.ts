import { AbstractTable } from "./abstract_table";
import type { ConnectedObjects } from "../base_types";
import type { AbstractTag } from "./abstract_tag";

export interface AbstractView {
  id?: number;
  name: string;
  viewtemplate: string;
  configuration?: string | any;
  table_name?: string;
  min_role: number;
  attributes?: any;
  connected_objects: () => Promise<ConnectedObjects>;
  getTags(): Promise<Array<AbstractTag>>;
}

export type ViewCfg = {
  name: string;
  id?: number;
  viewtemplate: string;
  table_id?: number | null;
  table?: AbstractTable;
  exttable_name?: string;
  description?: string;
  table_name?: string;
  configuration?: string | any;
  min_role?: number;
  is_public?: boolean;
  default_render_page?: string;
  slug?: any;
  attributes?: any;
};

export type ViewPack = {
  table?: string | null;
  on_menu?: boolean;
  menu_label?: string;
  on_root_page?: boolean;
} & Omit<ViewCfg, "table">;

export const instanceOfView = (object: any): object is AbstractView => {
  return "name" in object && "viewtemplate" in object;
};
