import * as multiTenant from "./multi-tenant.js";
import { ReadStream, WriteStream } from "fs";
import { Row, Where, SelectOptions, PrimaryKeyValue } from "./internal.js";

type RequestContext = {
  tenant: string;
  client?: any;
  req?: any;
};

export type DbClient = {
  query: (text: string, values?: any[]) => Promise<any>;
  release: () => void;
};

export type DbExportsType = {
  tenant: typeof multiTenant;
  sqlsanitize: (s?: string) => string;
  connectObj: GenObj;
  isSQLite: boolean;
  is_node: boolean;
  driverName: string;
  mkWhere: (q: Where) => any;
  getTenantSchemaPrefix: () => string;
  insert: (table: string, data: GenObj, opts?: any) => Promise<any>;
  update: (
    table: string,
    data: Row,
    id: PrimaryKeyValue | Row | undefined,
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
    onError?: (err: Error) => Promise<T | void> | T | void
  ) => Promise<T>;
  commitAndBeginNewTransaction: () => Promise<void>;
  selectMaybeOne: (table: string, where: Where, opts?: any) => Promise<any>;
  query: (sql: string, params?: any) => Promise<any>;
  withTransaction: (
    fn: (rollback: any) => Promise<any>,
    onError?: (e: Error) => Promise<void>
  ) => Promise<any>;
  count: (
    table: string,
    where?: Where | undefined,
    opts?: SelectOptions
  ) => Promise<number>;
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
    client?: DbClient | null;
    inTransaction?: boolean;
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
  setRequestUserContext: (client: any, isLocal?: boolean) => Promise<void>;
  is_it_multi_tenant: () => boolean;
  updateWhere: (table: string, data: Row, where: Where) => Promise<any>;
  slugify: (str: string) => string;
  runWithTenant: (
    tenantId: string | RequestContext,
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
  create_tenant_schema: (name: string, ifNotExists?: boolean) => Promise<void>;
  drop_tenant_schema: (name: string) => Promise<void>;
  serial_pk_sql_type: string;
  json_sql_type: string;
  indexable_text_sql_type: string;
  translateMigrationsFromPostgresql?: (sql: string) => string;
  upsert_config: (key: string, value: any) => Promise<void>;
  array_agg_sql_fn?: string;
  sqlDialectFactory?: (initCount?: number) => any;
  supports_search_path: boolean;
  // Backend capability flags (each replaces an overloaded `isSQLite` use)
  // DB has tenant schemas / schema-qualified table names (postgres yes, sqlite no)
  supports_multiple_schemas: boolean;
  // driver pools connections: transactions need a dedicated client via
  // getClient()/release() (postgres, mysql yes; sqlite no - single connection)
  pools_connections: boolean;
  // supports SELECT ... FOR UPDATE row locking
  supports_for_update: boolean;
  // supports postgres-style row-level security (postgres only; NOT mysql)
  supports_row_level_security: boolean;
  // supports advanced ALTER TABLE DDL: DROP COLUMN, RENAME TABLE, ALTER COLUMN
  // default/nullability, ADD CONSTRAINT (check/fkey). sqlite supports none.
  supports_alter_table: boolean;
  // supports non-integer (e.g. UUID) primary keys (sqlite requires integer pk)
  supports_non_integer_pk: boolean;
  // JSON columns are returned as strings that need JSON.parse on read
  json_read_returns_string: boolean;
  // JSON values must be JSON.stringify'd before insert/update
  json_write_needs_stringify: boolean;
  // dates are stored/returned as text or epoch numbers, not native Date objects
  stores_dates_as_text: boolean;
  // large `IN (...)` / bind-variable lists are safe (sqlite has a ~999 var limit)
  supports_large_bind_lists: boolean;
  // supports creating SQL database views
  supports_database_views: boolean;
  // supports schema introspection / table discovery
  supports_table_discovery: boolean;
  // session store supports pruning expired sessions on an interval
  supports_session_pruning: boolean;
  // emit engine SQL to defer foreign-key checks within an open transaction
  deferForeignKeys: (client: any) => Promise<void>;
  // extract the offending field name from a unique-violation error message
  parseUniqueConstraintError: (msg: string, tableName: string) => string;
  // canonical key for a multi-field unique constraint, matched against the
  // field name parsed from a unique-violation error (engine naming convention)
  uniqueConstraintFieldsKey: (fields: string[], tableName: string) => string;
  getExpressSessionStore: (
    session: any,
    opts?: { pruneInterval?: number }
  ) => any;
  [key: string]: any;
};

export type GenObj = { [key: string]: any };
