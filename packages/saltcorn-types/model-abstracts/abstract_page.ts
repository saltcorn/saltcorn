/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_page
 * @subcategory model-abstracts
 */
import type { GenObj } from "../common_types.js";
import type { Layout } from "../base_types.js";
import type { ConnectedObjects } from "../base_types.js";
import type { AbstractTag } from "./abstract_tag.js";

/** A standalone page, addressable by name, with its own layout. */
export interface AbstractPage {
  id?: number;
  name: string;
  layout: Layout;
  min_role: number;
  connected_objects: () => ConnectedObjects;
  getTags(): Promise<Array<AbstractTag>>;
}

/** Configuration for creating/updating an {@link AbstractPage}. */
export type PageCfg = {
  name: string;
  title: string;
  description: string;
  min_role: number;
  id?: number;
  layout: string | Layout | GenObj;
  fixed_states?: string | any;
  attributes?: any;
  updated_at?: Date;
};

/** A portable (import/export) representation of a {@link PageCfg}. */
export type PagePack = {
  menu_label?: string;
  root_page_for_roles?: string[];
} & PageCfg;

/**
 * Type guard for {@link AbstractPage}.
 * @param object - the value to test
 * @returns true if object is an {@link AbstractPage}
 */
export const instanceOfPage = (object: any): object is AbstractPage => {
  return object && "name" in object && "layout" in object;
};
