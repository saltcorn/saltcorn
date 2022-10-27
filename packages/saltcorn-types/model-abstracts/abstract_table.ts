import { AbstractField, FieldCfg } from "./abstract_field";
import { TriggerCfg } from "./abstract_trigger";
import type { AbstractTag } from "./abstract_tag";

export interface AbstractTable {
  name: string;
  id?: number;
  // is actually a getter
  sql_name: string;
  fields?: AbstractField[] | null;
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
  description?: string;
  fields: FieldCfg[];
};

export type TablePack = {
  triggers?: TriggerCfg[];
  constraints?: Array<any>;
  ownership_field_name?: string | null;
} & TableCfg;
