import { FieldCfg } from "./abstract_field";
import { TriggerCfg } from "./abstract_trigger";

export interface AbstractTable {
  name: string;
  id?: number;
  // is actually a getter
  sql_name: string;
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

export type PackTable = {
  triggers?: TriggerCfg[];
  constraints?: Array<any>;
  ownership_field_name?: string | null;
} & TableCfg;
