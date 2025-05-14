import { Row, SelectOptions, Where } from "@saltcorn/db-common/internal";
import { GenObj } from "@saltcorn/types/common_types";
import * as multiTenant from "@saltcorn/db-common/multi-tenant";
import { ReadStream, WriteStream } from "fs";

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
  tryCatchInTransaction: (
    fn: () => Promise<any>,
    onError?: (err: Error) => Promise<void>
  ) => Promise<any>;
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
    options?: { tokenize?: string; language?: string }
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
    fn: (tenantId: string) => Promise<void>
  ) => Promise<void>;
};

export type ResultType = {
  set_fields?: GenObj;
  halt_steps?: boolean;
  notify?: string;
  notify_success?: string;
  error?: string;
  goto?: string;
  [key: string]: any;
};

export type StepResType = ResultType & {
  goto_step?: number;
  clear_return_values?: boolean;
};
