/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_plugin
 * @subcategory model-abstracts
 */
import type { PluginSourceType } from "../base_types.js";

/** An installed Saltcorn plugin (module, theme, or pack of custom types). */
export interface AbstractPlugin {
  id?: number | string;
  location: string;
  name: string;
  version?: string | number;
  documentation_link?: string;
  configuration?: string | any;
  source: PluginSourceType;
  description?: string;
  has_theme?: boolean;
  has_auth?: boolean;
  unsafe?: boolean;
  deploy_private_key?: string;
}

/** Configuration for installing/updating an {@link AbstractPlugin}. */
export type PluginCfg = {
  id?: number | string;
  location: string;
  name: string;
  version?: string | number;
  documentation_link?: string;
  configuration?: string | any;
  source: PluginSourceType;
  description?: string;
  contents?: string;
  has_theme?: boolean;
  has_auth?: boolean;
  unsafe?: boolean;
  deploy_private_key?: string;
};

/** A portable (import/export) representation of a {@link PluginCfg}. */
export type PluginPack = {} & PluginCfg;

/**
 * Type guard for {@link AbstractPlugin}.
 * @param object - the value to test
 * @returns true if object is an {@link AbstractPlugin}
 */
export const instanceOfPlugin = (object: any): object is AbstractPlugin => {
  return (
    object && "name" in object && "location" in object && "source" in object
  );
};
