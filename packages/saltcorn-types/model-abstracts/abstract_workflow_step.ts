export type WorkflowStepCfg = {
    id?: number;
    name: string;
    trigger_id: number;
    next_step?: string;
    action_name: string;
    configuration: any;
};

export type WorkflowStepPack = {} & WorkflowStepCfg;
