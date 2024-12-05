export type WorkflowStepCfg = {
  id?: number;
  name: string;
  icon: string;
  layout: string | any;
};

export type WorkflowStepPack = {} & WorkflowStepCfg;
