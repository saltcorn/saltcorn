export type Value =
  | string
  | number
  | boolean
  | Date
  | Value[]
  | null
  | { [k: string]: Value };

export type JsonPathElem = string | number;
export type JsonPath = JsonPathElem | JsonPathElem[];

export type Where = {
  _fts?: { fields: any[]; table?: string; searchTerm: string; schema?: string };
  or?: Where[];
  not?: Where | symbol;
  eq?: Value[];
  [key: string]:
    | { in: Value[] }
    | { or: Value[] }
    | { gt: Value; equal?: boolean }
    | { lt: Value; equal?: boolean }
    | Value[]
    | { inSelect: { where: Where; field: string; table: string } }
    | null
    | symbol
    | any; // TODO Value
};

export type CoordOpts = {
  latField: number | string;
  longField: number | string;
  lat: number | string;
  long: number | string;
};

export type Operator =
  | "target"
  | "field"
  | { type: string; name: string; args: Operator[] };

export type SelectOptions = {
  orderBy?:
    | { distance: CoordOpts }
    | { operator: Operator | string; target: string; field: string }
    | string;
  limit?: string | number;
  offset?: string | number;
  forupdate?: boolean;
  nocase?: boolean;
  orderDesc?: boolean;
  cached?: boolean;
  ignore_errors?: boolean;
  versioned?: boolean; //TODO rm this and below
  min_role_read?: number;
  min_role_write?: number;
  ownership_field_id?: number;
  ownership_formula?: string;
  provider_name?: string;
  provider_cfg?: any;
  fields?: Array<string>;
  has_sync_info?: boolean;
  description?: string;
  recursive?: boolean; // for File.find()
  client?: DatabaseClient;
  schema?: any;
};
export type JoinField = {
  ref: string;
  target: string;
  through?: string | string[];
  rename_object?: string[];
  ontable?: string;
  lookupFunction?: (row: Row) => Promise<Value>;
};

export type JoinFields = {
  [key: string]: JoinField;
};

export type JoinOptions = {
  joinFields?: JoinFields;
  aggregations?: { [nm: string]: AggregationOptions };
  where?: Where;
  starFields?: boolean;
} & SelectOptions;

export type AggregationOptions = {
  table: string;
  ref?: string;
  field?: string;
  valueFormula?: string;
  where?: Where;
  aggregate: string;
  subselect?: SubselectOptions;
  through?: string;
  orderBy?: string;
  rename_to?: string;
};

export type SubselectOptions = {
  tableName: string;
  whereField: string;
  field: string;
  table: any; // TODO without circular deps
};

export type DatabaseClient = {
  query: (sql: String, parameters?: any[]) => Promise<{ rows: Row[] }>;
};

export type Row = { [key: string]: any };
export type StrongRow = { [key: string]: Value };
export type PrimaryKeyValue = number | string;

//https://stackoverflow.com/a/57390160/19839414
export type PartialSome<T, K extends keyof T> = Partial<T> & Pick<T, K>;
