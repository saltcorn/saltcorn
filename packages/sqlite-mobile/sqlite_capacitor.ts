import {
  Row,
  sqlsanitize,
  Where,
  SelectOptions,
  mkWhere,
  mkSelectOptions,
} from "@saltcorn/db-common/internal";
import {
  buildInsertSql,
  buildInsertBulkSql,
  doCount,
  doDeleteWhere,
  mkVal,
  doListTables,
  doListUserDefinedTables,
  doListScTables,
  do_add_index,
  do_drop_index,
  slugify,
  withTransaction,
  afterCommit,
  tryCatchInTransaction,
} from "@saltcorn/db-common/sqlite-commons";
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";

export { slugify, withTransaction, afterCommit, tryCatchInTransaction };

declare let window: any;

let connobj: any = null;
let db: SQLiteDBConnection | null = null;

/**
 *
 * @param connobjPara
 */
export const setConnectionObject = (connobjPara: any): void => {
  connobj = connobjPara;
};

export const init = async () => {
  try {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    if (window.Capacitor.getPlatform() === "web") await sqlite.initWebStore();
    const dbExists = await sqlite.isDatabase("prepopulated");
    if (!dbExists.result) await sqlite.copyFromAssets(true);
    try {
      await sqlite.closeConnection("prepopulated", false);
      console.log("Connection was open, reopening it");
    } catch (e) {
      console.log("Connection wasn't open");
    }
    db = await sqlite.createConnection(
      "prepopulated",
      false,
      "no-encryption",
      1,
      false
    );
    await db.open();
  } catch (e) {
    console.log("Unable to init the sqlite db: ", e);
    throw e;
  }
};

export const query = async (statement: string, params?: any) => {
  const result = await db?.query(statement, params);
  return { rows: result?.values || [] };
};

export const insert = async (
  tbl: string,
  obj: Row,
  opts: {
    noid?: boolean;
    ignoreExisting?: boolean;
    replace?: boolean;
    jsonCols?: string[];
  } = {}
) => {
  const { sql, valList } = buildInsertSql(tbl, obj, opts);
  await query(sql, valList);
  const ids = await query("SELECT last_insert_rowid() as id");
  return ids.rows[0].id;
};

export const insertRows = async (
  tbl: string,
  rows: Row[],
  opts: { noid?: boolean; ignoreExisting?: boolean; replace?: boolean } = {}
) => {
  if (rows.length === 0) return;
  const bulkCmds = buildInsertBulkSql(tbl, rows, opts);
  for (const { sql, vals } of bulkCmds) {
    await query(sql, vals);
  }
};

export const select = async (
  tbl: string,
  whereObj: Where,
  selectopts: SelectOptions = {}
): Promise<Row[]> => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `SELECT * FROM "${sqlsanitize(tbl)}" ${where} ${mkSelectOptions(
    selectopts,
    values,
    true
  )}`;
  const tq = await query(sql, values);
  return tq.rows;
};

export const drop_reset_schema = () => {
  // propably not needed on mobile ?
  throw new Error("Not implemented");
};

/**
 *
 * @param tbl
 * @param whereObj
 * @returns
 */
export const count = async (tbl: string, whereObj: Where) => {
  return await doCount(tbl, whereObj, query);
};

export const deleteWhere = async (
  tbl: string,
  whereObj: Where
): Promise<void> => {
  await doDeleteWhere(tbl, whereObj, query);
};

/**
 *
 * @param tbl
 * @param where
 * @returns
 */
export const selectMaybeOne = async (
  tbl: string,
  where: Where
): Promise<Row | null> => {
  const rows = await select(tbl, where);
  if (rows.length === 0) return null;
  else return rows[0];
};

/**
 *
 * @param tbl
 * @param where
 * @returns
 */
export const selectOne = async (tbl: string, where: Where): Promise<Row> => {
  const rows = await select(tbl, where);
  if (rows.length === 0) {
    const w = mkWhere(where, true);
    throw new Error(`no ${tbl} ${w.where} are ${w.values}`);
  } else return rows[0];
};

/**
 *
 * @param tbl
 * @param obj
 * @param id
 * @param opts
 */
export const update = async (
  tbl: string,
  obj: Row,
  id: string | number,
  opts: { jsonCols?: string[] } = {}
): Promise<void> => {
  const kvs = Object.entries(obj);
  const assigns = kvs
    .map(
      ([k, v], ix) =>
        `"${sqlsanitize(k)}"=${
          opts.jsonCols?.includes(k) && (v === true || v === false)
            ? "json(?)"
            : "?"
        }`
    )
    .join();
  let valList = kvs.map(([k, v]) => mkVal([k, v], opts.jsonCols?.includes(k)));
  valList.push(id);
  const q = `update "${sqlsanitize(tbl)}" set ${assigns} where id=?`;
  await query(q, valList);
};

/**
 * Add unique constraint
 * @param table_name - table name
 * @param field_names - list of columns (members of constraint)
 * @returns no result
 */
export const add_unique_constraint = async (
  table_name: string,
  field_names: string[]
): Promise<void> => {
  await do_add_index(table_name, field_names, query, true);
};

/**
 * Drop unique constraint
 * @param table_name - table name
 * @param field_names - list of columns (members of constraint)
 * @returns no results
 */
export const drop_unique_constraint = async (
  table_name: string,
  field_names: string[]
): Promise<void> => {
  await do_drop_index(table_name, field_names, query, true);
};

/**
 * Add unique constraint
 * @param table_name - table name
 * @param field_name - column name
 * @returns no result
 */
export const add_index = async (
  table_name: string,
  field_name: string
): Promise<void> => {
  await do_add_index(table_name, [field_name], query, false);
};

/**
 * Drop index
 * @param table_name - table name
 * @param field_name - column name
 * @returns no results
 */
export const drop_index = async (
  table_name: string,
  field_name: string
): Promise<void> => {
  await do_drop_index(table_name, [field_name], query, false);
};

export const time = () => new Date();

/**
 *
 * @returns
 */
export const listTables = async () => {
  return await doListTables(query);
};

/**
 *
 * @returns
 */
export const listUserDefinedTables = async () => {
  return await doListUserDefinedTables(query);
};

/**
 *
 * @returns
 */
export const listScTables = async () => {
  return await doListScTables(query);
};

/**
 *
 * @param name table name
 * @returns
 */
export const tableExists = async (name: string) => {
  const tables = await listTables();
  return tables.find((table: Row) => table.name === name);
};

// Capacitor/mobile sqlite shares the node sqlite backend's capabilities. These
// mirror @saltcorn/sqlite so call sites can key off driver capability flags
// instead of `db.isSQLite`.
export const driverName = "sqlite";
export const sql_backend_display_name = "SQLite";
export const array_agg_sql_fn = "json_group_array";
export const serial_pk_sql_type = "integer";
export const json_sql_type = "json";
export const indexable_text_sql_type = "text";
export const timestamp_sql_type = "timestamptz";
export const millis_timestamp_sql_type = "timestamp";
export const supports_search_path = false;

export const supports_multiple_schemas = false;
export const pools_connections = false;
export const supports_for_update = false;
export const supports_row_level_security = false;
export const supports_alter_table = false;
export const supports_non_integer_pk = false;
export const json_read_returns_string = true;
export const json_write_needs_stringify = false;
export const stores_dates_as_text = true;
export const supports_large_bind_lists = false;
export const supports_database_views = false;
export const supports_table_discovery = false;
export const supports_session_pruning = false;
export const supports_agg_order_by = true;
export const coerce_numeric_aggregates_to_string = false;
export const uses_positional_placeholders = true;
export const coerce_read_dates = true;

// SQL-expression builders (see DbExportsType in db-common/types)
// These mirror the Postgres forms: the sync/history SQL paths were only ever
// specialised for MySQL, so non-MySQL engines keep the original Postgres SQL.
export const epochToTimestampSql = (param: string): string =>
  `to_timestamp(${param})`;
export const truncateMillisSql = (expr: string): string =>
  `date_trunc('milliseconds', ${expr})`;
export const castExprToTextSql = (expr: string): string => `${expr}::text`;
export const castBindParamSql = (
  param: string,
  sqlType: "text" | "jsonb"
): string => `${param}::${sqlType}`;

// history-trim SQL fragments (mirror Postgres; only MySQL specialised)
export const timeDiffWithinSql = (
  startExpr: string,
  endExpr: string,
  seconds: number
): string => `${endExpr} - ${startExpr} <= INTERVAL '${seconds} seconds'`;
export const isDistinctFromSql = (a: string, b: string): string =>
  `${a} IS DISTINCT FROM ${b}`;
export const wrapDeleteSubselect = (subquery: string): string => subquery;

// column DDL (mirror Postgres; only MySQL specialised)
export const text_requires_length_for_index = false;
export const setColumnNullabilitySql = (
  qTable: string,
  qCol: string,
  _sqlType: string,
  notNull: boolean
): string =>
  `alter table ${qTable} alter column ${qCol} ${
    notNull ? "set" : "drop"
  } not null;`;
export const alterColumnTypeSql = (
  qTable: string,
  qCol: string,
  newType: string,
  using: string,
  def: string
): string =>
  `alter table ${qTable} alter column ${qCol} TYPE ${newType} ${using} ${def};`;
export const changePkColumnTypeStatements = (
  qTable: string,
  qCol: string,
  newType: string,
  def: string,
  _wasAlreadyPk: boolean
): string[] => [
  `ALTER TABLE ${qTable} drop column ${qCol};`,
  `ALTER TABLE ${qTable} add column ${qCol} ${newType} primary key ${def};`,
];

// foreign-key DDL (mirror Postgres; only MySQL specialised)
export const inline_fk_in_column_type = true;
export const fk_must_be_dropped_before_column = false;
export const fk_deferrable_clause = "";
export const dropForeignKeyIfExists = async (
  qTable: string,
  conName: string
): Promise<void> => {
  await query(`ALTER TABLE ${qTable} drop constraint if exists "${conName}"`);
};
export const replaceForeignKey = async (params: {
  qTable: string;
  oldConName: string;
  newConName: string;
  colName: string;
  qRefTable: string;
  refCol: string;
  onDelete: string;
}): Promise<void> => {
  const { qTable, oldConName, newConName, colName, qRefTable, refCol, onDelete } =
    params;
  await query(
    `ALTER TABLE ${qTable} drop constraint "${oldConName}", add constraint "${newConName}" foreign key ("${colName}") references ${qRefTable}("${refCol}")${onDelete}${fk_deferrable_clause}`
  );
};
export const addColumnWithDefault = async (params: {
  qTable: string;
  colName: string;
  sqlType: string;
  bareType: string;
  required: boolean;
  defaultValue: any;
}): Promise<void> => {
  const { qTable, colName, sqlType, required, defaultValue } = params;
  await query(
    `alter table ${qTable} add column "${sqlsanitize(colName)}" ${sqlType} ${
      required ? `not null default ${JSON.stringify(defaultValue)}` : ""
    }`
  );
};
export const isDuplicateForeignKeyError = (_e: any): boolean => false;

// misc dialect-specific SQL / behaviour (mirror Postgres unless noted)
export const jsonMergeExpr = (colExpr: string, param: string): string =>
  `coalesce(${colExpr}, '{}'::jsonb) || ${param}::jsonb`;
// no array parameters: IN-lists expand to positional placeholders
export const supports_array_param_in = false;
// no server-side session store to clear
export const deleteSessionsForUser = async (): Promise<void> => {};
export const deleteSessionsForTenant = async (): Promise<void> => {};
export const dropCheckConstraintIfExists = async (
  qTable: string,
  conName: string
): Promise<void> => {
  await query(`alter table ${qTable} drop constraint IF EXISTS "${conName}";`);
};
export const migration_sql_dialect = "sql_sqlite";
export const migration_translates_from_pg = false;
// discovery is unsupported here (supports_table_discovery=false); placeholders.
export const discovery_keys_uppercase = false;
export const discovery_columns_order_by = "";
export const discovery_pk_sql = "";
export const discovery_fk_sql = "";
export const dropPrimaryKey = async (
  schemaPrefix: string,
  tableName: string,
  tenantSchema: string
): Promise<void> => {
  const { rows } = await query(`select constraint_name
from information_schema.table_constraints
where table_schema = '${tenantSchema || "public"}'
      and table_name = '${tableName}'
      and constraint_type = 'PRIMARY KEY';`);
  const cname = rows[0]?.constraint_name;
  await query(
    `alter table ${schemaPrefix}"${tableName}" drop constraint "${cname}"`
  );
};

// Defer FK checks for the remainder of the current transaction.
export const deferForeignKeys = async (client: {
  query: (sql: string) => Promise<any>;
}): Promise<void> => {
  await client.query("PRAGMA defer_foreign_keys = ON");
};

// Pull the offending field name out of a unique-violation error message.
export const parseUniqueConstraintError = (
  msg: string,
  tableName: string
): string =>
  msg.replace(`SQLITE_CONSTRAINT: UNIQUE constraint failed: ${tableName}.`, "");

// Canonical key for a multi-field unique constraint, matched against the field
// name parsed above.
export const uniqueConstraintFieldsKey = (
  fields: string[],
  tableName: string
): string => {
  const [field1, ...rest] = fields;
  return [field1, ...rest.map((fnm) => `${tableName}.${fnm}`)].join(", ");
};
