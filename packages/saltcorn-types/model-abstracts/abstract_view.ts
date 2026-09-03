/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_view
 * @subcategory model-abstracts
 */
import type { AbstractTable } from "./abstract_table.js";
import type { ConnectedObjects } from "../base_types.js";
import type { AbstractTag } from "./abstract_tag.js";

/** A configured view: a viewtemplate bound to a table and a configuration. */
export interface AbstractView {
  id?: number;
  name: string;
  viewtemplate: string;
  configuration?: string | any;
  table_id?: number;
  table_name?: string;
  min_role: number;
  attributes?: any;
  connected_objects: () => Promise<ConnectedObjects>;
  getTags(): Promise<Array<AbstractTag>>;
}

/** Configuration for creating/updating an {@link AbstractView}. */
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
  updated_at?: Date;
};

/** A portable (import/export) representation of a {@link ViewCfg}. */
export type ViewPack = {
  table?: string | null;
  on_menu?: boolean;
  menu_label?: string;
  on_root_page?: boolean;
} & Omit<ViewCfg, "table">;

/**
 * Type guard for {@link AbstractView}.
 * @param object - the value to test
 * @returns true if object is an {@link AbstractView}
 */
export const instanceOfView = (object: any): object is AbstractView => {
  return object && "name" in object && "viewtemplate" in object;
};
