import * as multiTenant from "./multi-tenant.js";
import { ReadStream } from "fs";
import { Writable } from "stream";
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
  sql_backend_display_name: string;
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
  afterCommit: (fn: () => Promise<void>) => Promise<void>;
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
    afterCommit?: Array<() => Promise<void>>;
  };
  drop_fts_index: (table: string) => Promise<void>;
  drop_index: (table: string, columns: string[]) => Promise<void>;
  close: () => Promise<void>;
  truncate: (table: string) => Promise<void>;
  reset_sequence: (table: string, column?: string) => Promise<void>;
  time: () => Promise<Date>;
  copyToJson?: (
    // any writable: backups collect the dump in memory rather than on disk
    writeStream: Writable,
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
  timestamp_sql_type: string;
  millis_timestamp_sql_type: string;
  epochToTimestampSql: (param: string) => string;
  truncateMillisSql: (expr: string) => string;
  castExprToTextSql: (expr: string) => string;
  castBindParamSql: (param: string, sqlType: "text" | "jsonb") => string;
  timeDiffWithinSql: (
    startExpr: string,
    endExpr: string,
    seconds: number
  ) => string;
  // boolean: two expressions differ, treating NULLs as comparable (null == null)
  isDistinctFromSql: (a: string, b: string) => string;
  wrapDeleteSubselect: (subquery: string) => string;
  text_requires_length_for_index: boolean;
  // set/drop a column's NOT NULL constraint (qTable/qCol are already quoted)
  setColumnNullabilitySql: (
    qTable: string,
    qCol: string,
    sqlType: string,
    notNull: boolean
  ) => string;
  // change a column's type (postgres ALTER COLUMN TYPE ... USING vs MySQL MODIFY)
  alterColumnTypeSql: (
    qTable: string,
    qCol: string,
    newType: string,
    using: string,
    def: string
  ) => string;
  // statements to change a primary-key column's type: MySQL modifies in place
  // when the column was already the PK, others drop and re-add the column
  changePkColumnTypeStatements: (
    qTable: string,
    qCol: string,
    newType: string,
    def: string,
    wasAlreadyPk: boolean
  ) => string[];
  // foreign-key DDL (dialect-specific):
  // FK constraint is declared inline in the column type (postgres/sqlite) vs
  // added separately after the column (MySQL)
  inline_fk_in_column_type: boolean;
  // the FK constraint must be dropped before its column can be dropped (MySQL)
  fk_must_be_dropped_before_column: boolean;
  // suffix appended to ADD CONSTRAINT ... FOREIGN KEY (" DEFERRABLE" on postgres;
  // empty where deferrable constraints are unsupported)
  fk_deferrable_clause: string;
  // drop a FK constraint if present, swallowing "already absent" errors
  dropForeignKeyIfExists: (qTable: string, conName: string) => Promise<void>;
  // drop an existing FK and add a replacement (changed ON DELETE / reftable)
  replaceForeignKey: (params: {
    qTable: string;
    oldConName: string;
    newConName: string;
    colName: string;
    qRefTable: string;
    refCol: string;
    onDelete: string;
  }) => Promise<void>;
  // add a column carrying a non-trivial default value
  addColumnWithDefault: (params: {
    qTable: string;
    colName: string;
    sqlType: string;
    bareType: string;
    required: boolean;
    defaultValue: any;
  }) => Promise<void>;
  // whether an error is a "duplicate foreign key name" error (idempotent add)
  isDuplicateForeignKeyError: (e: any) => boolean;
  // misc dialect-specific SQL / behaviour:
  // merge a JSON object (param) into a JSON column, coalescing NULL to {}
  jsonMergeExpr: (colExpr: string, param: string) => string;
  // IN-list matching uses a single array parameter (`= ANY($n)`); engines
  // where this is false expand to positional `in ($a,$b,...)`
  supports_array_param_in: boolean;
  // delete stored sessions for a user / for a whole tenant (session storage is
  // engine-specific; sqlite has no server-side session store to clear)
  deleteSessionsForUser: (userId: string, tenant: string) => Promise<void>;
  deleteSessionsForTenant: (tenant: string) => Promise<void>;
  // drop a CHECK constraint if present, swallowing "not found" errors
  dropCheckConstraintIfExists: (
    qTable: string,
    conName: string
  ) => Promise<void>;
  // migration-file key holding this engine's SQL ("sql_pg"/"sql_sqlite"/"sql_mysql")
  migration_sql_dialect: string;
  // derive migration SQL by translating the postgres block when this engine has
  // no dedicated block (and the migration is cross-dialect)
  migration_translates_from_pg: boolean;
  // information_schema introspection returns column aliases upper-cased
  discovery_keys_uppercase: boolean;
  // trailing ORDER BY appended to the discovery columns query
  discovery_columns_order_by: string;
  // engine-specific queries returning a table's primary-key / foreign-key rows
  // (bind params $1 = schema, $2 = table)
  discovery_pk_sql: string;
  discovery_fk_sql: string;
  // drop a table's primary-key constraint (MySQL DROP PRIMARY KEY vs looking up
  // and dropping the named constraint)
  dropPrimaryKey: (
    schemaPrefix: string,
    tableName: string,
    tenantSchema: string
  ) => Promise<void>;
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
  // `array_agg(... ORDER BY ...)` is supported (postgres/sqlite yes; MySQL's
  // JSON_ARRAYAGG has no in-aggregate ordering)
  supports_agg_order_by: boolean;
  // numeric aggregates (count/sum/avg) come back as JS numbers and must be
  // stringified to match the string representation other engines return
  coerce_numeric_aggregates_to_string: boolean;
  // bound parameters are positional `?` (repeated per use) rather than numbered
  // `$n` (referenced by index) — affects how repeated where-clauses are bound
  uses_positional_placeholders: boolean;
  // the Date type's readFromDB must coerce the raw DB value into a Date/PlainDate
  // (engines that hand back text/epoch, or MySQL's day-only values)
  coerce_read_dates: boolean;
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
