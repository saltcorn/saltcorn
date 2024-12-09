import type { AbstractTable } from "./abstract_table";
import type { AbstractTag } from "./abstract_tag";
import type { WorkflowStepCfg } from "./abstract_workflow_step";

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
  min_role?: number;

  toJson(): any;
  delete(): Promise<void>;
  clone(): Promise<AbstractTrigger>;

  runWithoutRow(runargs: any): Promise<boolean>;
  getTags(): Promise<Array<AbstractTag>>;
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
  steps?: Array<WorkflowStepCfg>;
};

export type TriggerPack = {} & TriggerCfg;
