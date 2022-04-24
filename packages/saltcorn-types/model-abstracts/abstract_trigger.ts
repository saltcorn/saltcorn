import type { AbstractTable } from "./abstract_table";

export interface AbstractTrigger {
  name?: string;
  action: string;
  description?: string;
  table_id?: number | null;
  table_name?: string;
  when_trigger: string;
  channel?: string;
  id?: number | null;
  configuration: any;
  min_role?: number | null;

  toJson(): any;
  delete(): Promise<void>;
  runWithoutRow(runargs: any): Promise<boolean>;
}

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
