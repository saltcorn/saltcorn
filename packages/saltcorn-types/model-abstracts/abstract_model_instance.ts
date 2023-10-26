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

export type ModelInstancePack = {
  model_name: string;
  table_name: string;
} & Omit<ModelInstanceCfg, "model_id" | "id">;
