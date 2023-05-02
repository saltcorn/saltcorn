export type ModelCfg = {
  id?: number;
  name: string;
  table_id: number;
  modeltemplate: string;
  configuration: any;
};

export type ModelInstanceCfg = {
  id?: number;
  name: string;
  model_id: number;
  state: any;
  hyperparameters: any;
  trained_on: Date;
  report: string;
  metric_values: any;
  blob: any;
};

//export type LibraryPack = {} & LibraryCfg;
