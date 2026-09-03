/**
 * @category saltcorn-types
 * @module model-abstracts/abstract_model
 * @subcategory model-abstracts
 */

/** Configuration for a machine-learning Model attached to a table. */
export type ModelCfg = {
  id?: number;
  name: string;
  table_id: number;
  modelpattern: string;
  configuration: any;
};

/** A portable (import/export) representation of a {@link ModelCfg}. */
export type ModelPack = {
  table_name: string;
} & Omit<ModelCfg, "id" | "table_id">;
