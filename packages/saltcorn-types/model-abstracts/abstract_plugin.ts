import type { PluginSourceType } from "../base_types";

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

export type PluginCfg = {
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
};

export type PluginPack = {} & PluginCfg;

export const instanceOfPlugin = (object: any): object is AbstractPlugin => {
  return (
    object && "name" in object && "location" in object && "source" in object
  );
};
