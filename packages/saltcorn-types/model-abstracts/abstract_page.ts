import { GenObj } from "../common_types";
import type { Layout } from "../base_types";
import type { ConnectedObjects } from "../base_types";

export interface AbstractPage {
  id?: number;
  name: string;
  layout: Layout;
  connected_objects: () => ConnectedObjects;
}

export type PageCfg = {
  name: string;
  title: string;
  description: string;
  min_role: number;
  id?: number;
  layout: string | Layout | GenObj;
  fixed_states?: string | any;
};

export type PagePack = {
  menu_label?: string;
  root_page_for_roles?: string[];
} & PageCfg;
