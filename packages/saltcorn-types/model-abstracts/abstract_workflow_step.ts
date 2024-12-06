export type WorkflowStepCfg = {
  id?: number;
  name: string;
  trigger_id: number;
  next_step?: string;
  action_name: string;
  initial_step: boolean;
  configuration: any;
};

export type WorkflowStepPack = {} & WorkflowStepCfg;
