import { AbstractTable } from "./abstract_table";

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
};

export type ViewPack = {
  table?: string | null;
  on_menu?: boolean;
  menu_label?: string;
  on_root_page?: boolean;
} & Omit<ViewCfg, "table">;
