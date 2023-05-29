import { AbstractField, FieldCfg } from "./abstract_field";
import { TriggerCfg } from "./abstract_trigger";
import type { AbstractTag } from "./abstract_tag";

export interface AbstractTable {
  name: string;
  id?: number;
  // is actually a getter
  sql_name: string;
  fields: AbstractField[];
  getTags(): Promise<Array<AbstractTag>>;
  getForeignTables(): Promise<Array<AbstractTable>>;
}

export type TableCfg = {
  name: string;
  id?: number;
  min_role_read: number;
  min_role_write: number;
  ownership_field_id?: string;
  ownership_formula?: string;
  versioned?: boolean;
  is_user_group?: boolean;
  description?: string;
  fields: FieldCfg[];
  constraints?: any[];
  provider_name?: string;
  provider_cfg?: any;
};

export type TablePack = {
  triggers?: TriggerCfg[];
  constraints?: Array<any>;
  ownership_field_name?: string | null;
} & TableCfg;
