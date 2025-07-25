import * as multiTenant from "./multi-tenant";
import { ReadStream, WriteStream } from "fs";
import { Row, Where, SelectOptions } from "./internal";

export type DbExportsType = {
  tenant: typeof multiTenant;
  sqlsanitize: (s?: string) => string;
  connectObj: GenObj;
  isSQLite: boolean;
  is_node: boolean;
  mkWhere: (q: Where) => any;
  getTenantSchemaPrefix: () => string;
  insert: (table: string, data: GenObj, opts?: any) => Promise<any>;
  update: (
    table: string,
    data: Row,
    id: number | string | undefined,
    opts?: any
  ) => Promise<any>;
  delete: (table: string, where: Where) => Promise<any>;
  select: (
    table: string,
    where?: Where | string,
    opts?: SelectOptions | undefined
  ) => Promise<any>;
  reset: () => Promise<void>;
  tryCatchInTransaction: <T>(
    fn: () => Promise<T>,
    onError?: (err: Error) => Promise<void> | void
  ) => Promise<T>;
  commitAndRestartTransaction: () => Promise<void>;
  selectMaybeOne: (table: string, where: Where, opts?: any) => Promise<any>;
  query: (sql: string, params?: any) => Promise<any>;
  withTransaction: (
    fn: () => Promise<any>,
    onError?: (e: Error) => Promise<void>
  ) => Promise<void>;
  count: (table: string, where?: Where | undefined) => Promise<number>;
  deleteWhere: (table: string, where: Where) => Promise<any>;
  selectOne: (
    table: string,
    where: Where,
    opts?: SelectOptions | undefined
  ) => Promise<any>;
  add_unique_constraint: (
    table: string | undefined,
    columns: string[]
  ) => Promise<void>;
  drop_unique_constraint: (
    table: string | undefined,
    columns: string[]
  ) => Promise<void>;
  getTenantSchema: () => string;
  add_fts_index: (
    table: string,
    column: string,
    language?: string,
    disable_fts?: boolean
  ) => Promise<void>;
  add_index: (table: string, columns: string[]) => Promise<void>;
  getRequestContext: () => {
    req: {
      getLocale: () => string;
      __: (str: string) => string;
    };
    client?: object | string;
  };
  drop_fts_index: (table: string) => Promise<void>;
  drop_index: (table: string, columns: string[]) => Promise<void>;
  close: () => Promise<void>;
  truncate: (table: string) => Promise<void>;
  reset_sequence: (table: string, column?: string) => Promise<void>;
  time: () => Promise<Date>;
  copyToJson?: (
    writeStream: WriteStream,
    table: string,
    opts?: any
  ) => Promise<void>;
  getClient: () => Promise<any>;
  is_sqlite: boolean;
  copyFrom: (
    readStream: ReadStream,
    table: string,
    fieldNames: any[],
    client: any
  ) => Promise<any>;
  set_sql_logging: (enabled: boolean) => void;
  is_it_multi_tenant: () => boolean;
  updateWhere: (table: string, data: Row, where: Where) => Promise<any>;
  slugify: (str: string) => string;
  runWithTenant: (
    tenantId: string,
    // fn: (tenantId?: string) => Promise<void | string>
    fn: any
  ) => Promise<any>;
  drop_reset_schema: () => Promise<void>;
  listTables: () => Promise<any>;
  listUserDefinedTables: () => Promise<any>;
  listScTables: () => Promise<any>;
  dropTable: (table: string) => Promise<any>;
  dropTables: (tables: string[]) => Promise<any>;
  get_db_filepath: () => string;
  setConnectionObject: (connectObj: any) => void;
  changeConnection: (connectObj: any) => void;
  begin: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  get_sql_logging: () => boolean;
  getVersion: (arg?: boolean) => Promise<string>;
  enable_multi_tenant: () => void;
  [key: string]: any;
};

export type GenObj = { [key: string]: any };
