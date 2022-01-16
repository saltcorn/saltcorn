import type { PluginSourceType } from "../base_types";

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
  deploy_private_key?: string;
};

export type PackPlugin = {} & PluginCfg;
