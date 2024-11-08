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
} from "@saltcorn/db-common/sqlite-commons";
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from "@capacitor-community/sqlite";

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
    const dbExists = await sqlite.isDatabase("prepopulated");
    if (!dbExists.result) await sqlite.copyFromAssets();
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
