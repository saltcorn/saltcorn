import { GenObj } from "../common_types";
import type { Layout } from "../base_types";
import type { ConnectedObjects } from "../base_types";
import type { AbstractTag } from "./abstract_tag";

export interface AbstractPage {
  id?: number;
  name: string;
  layout: Layout;
  min_role: number;
  connected_objects: () => ConnectedObjects;
  getTags(): Promise<Array<AbstractTag>>;
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

export const instanceOfPage = (object: any): object is AbstractPage => {
  return "name" in object && "layout" in object;
};
