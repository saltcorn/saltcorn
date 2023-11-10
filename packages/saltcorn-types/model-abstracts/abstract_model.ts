export type ModelCfg = {
  id?: number;
  name: string;
  table_id: number;
  modelpattern: string;
  configuration: any;
};

export type ModelPack = {
  table_name: string;
} & Omit<ModelCfg, "id" | "table_id">;
