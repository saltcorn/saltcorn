/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_model_instance
 * @subcategory model-abstracts
 */

/** A trained instance of a ModelCfg (model-abstracts/abstract_model). */
export type ModelInstanceCfg = {
  id?: number;
  name: string;
  model_id: number;
  state: any;
  hyperparameters: any;
  trained_on: Date;
  report: string;
  metric_values: any;
  parameters: any;
  fit_object: Buffer;
  is_default?: boolean;
};

/** A portable (import/export) representation of a {@link ModelInstanceCfg}. */
export type ModelInstancePack = {
  model_name: string;
  table_name: string;
} & Omit<ModelInstanceCfg, "model_id" | "id">;
