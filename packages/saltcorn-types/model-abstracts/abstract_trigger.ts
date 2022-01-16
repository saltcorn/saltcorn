import type { AbstractTable } from "./abstract_table";

export type TriggerCfg = {
  name?: string;
  action: string;
  description?: string;
  table_id?: number | null;
  table_name?: string;
  table?: AbstractTable;
  when_trigger: string;
  channel?: string;
  id?: number | null;
  configuration?: any;
  min_role?: number;
};

export type TriggerPack = {} & TriggerCfg;
