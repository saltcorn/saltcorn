/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_workflow_step
 * @subcategory model-abstracts
 */

/** Configuration for one step of a workflow trigger. */
export type WorkflowStepCfg = {
  id?: number;
  name: string;
  trigger_id: number;
  next_step?: string;
  only_if?: string;
  action_name: string;
  initial_step: boolean;
  configuration: any;
};

/** A portable (import/export) representation of a {@link WorkflowStepCfg}. */
export type WorkflowStepPack = {} & WorkflowStepCfg;
