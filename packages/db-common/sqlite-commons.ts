/**
 * This is the sqlite-common module
 * It contains utils for "@saltcorn/sqlite" and "@saltcorn/sqlite-mobile"
 * @module
 */
import { Row, sqlsanitize, Value, mkWhere, Where } from "./internal";

/**
 * @param v
 * @returns
 * @function
 */
export const reprAsJson = (v: any): boolean =>
  typeof v === "object" && v !== null && !(v instanceof Date);

/**
 * @param opts
 * @param opts.k
 * @param  opts.v
 * @returns
 */
export const mkVal = ([k, v]: [string, any]): Value =>
  reprAsJson(v) ? JSON.stringify(v) : v;

/**
 * return type of buildInsertSql()
 * wraps the INSERT sql string and the values to insert
 */
export type SqlAndValues = {
  sql: string;
  valList: Array<any>;
};

/**
 *
 * @param tbl
 * @param obj
 * @param opts
 * @returns
 */
export const buildInsertSql = (
  tbl: string,
  obj: Row,
  opts: { noid?: boolean; ignoreExisting?: boolean } = {}
): SqlAndValues => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  const valPosList = kvs
    .map(([k, v], ix: any) =>
      v && v.next_version_by_id
        ? `coalesce((select max(_version) from "${sqlsanitize(
            tbl
          )}" where id=${+v.next_version_by_id}), 0)+1`
        : reprAsJson(v)
        ? "json(?)"
        : "?"
    )
    .join();
  const valList = kvs
    .filter(([k, v]: [any, any]) => !(v && v.next_version_by_id))
    .map(mkVal);
  const ignoreExisting = opts.ignoreExisting ? "or ignore" : "";
  const sql = `insert ${ignoreExisting} into "${sqlsanitize(
    tbl
  )}"(${fnameList}) values(${valPosList})`;

  return {
    sql: sql,
    valList: valList,
  };
};

/**
 *
 * @param tbl
 * @param whereObj
 * @param queryFunc
 * @returns
 */
export const doCount = async (tbl: string, whereObj: Where, queryFunc: any) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `SELECT COUNT(*) FROM "${sqlsanitize(tbl)}" ${where}`;
  const tq = await queryFunc(sql, values);
  return parseInt(tq.rows[0]["COUNT(*)"]);
};

/**
 *
 * @param tbl
 * @param whereObj
 * @param queryFunc
 */
export const doDeleteWhere = async (
  tbl: string,
  whereObj: Where,
  queryFunc: any
) => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `delete FROM "${sqlsanitize(tbl)}" ${where}`;
  const tq = await queryFunc(sql, values);
};

/**
 * Add unique constraint
 * @param table_name - table name
 * @param field_names - list of columns (members of constraint)
 * @returns no result
 */
export const do_add_index = async (
  table_name: string,
  field_names: string[],
  query_func: any,
  is_unique: boolean,
  logger?: any
): Promise<void> => {
  const sql = `create ${is_unique ? `unique ` : ""}index ${sqlsanitize(
    table_name
  )}_${field_names.map((f) => sqlsanitize(f)).join("_")}${
    is_unique ? `_unique` : ""
  } on "${sqlsanitize(table_name)}"(${field_names
    .map((f) => `"${sqlsanitize(f)}"`)
    .join(",")});`;
  if (logger) logger(sql);
  await query_func(sql);
};

/**
 * Drop unique constraint
 * @param table_name - table name
 * @param field_names - list of columns (members of constraint)
 * @returns no results
 */
export const do_drop_index = async (
  table_name: string,
  field_names: string[],
  query_func: any,
  is_unique: boolean,
  logger?: any
): Promise<void> => {
  const sql = `drop index ${sqlsanitize(table_name)}_${field_names
    .map((f) => sqlsanitize(f))
    .join("_")}${is_unique ? `_unique` : ""};`;
  if (logger) logger(sql);
  await query_func(sql);
};

/**
 *
 * @param queryFunc
 * @returns
 */
export const doListTables = async (queryFunc: any) => {
  const sql = "SELECT * FROM sqlite_master where type='table'";
  const tq = await queryFunc(sql);
  return tq.rows;
};

/**
 *
 * @param queryFunc
 * @returns
 */
export const doListUserDefinedTables = async (queryFunc: any) => {
  return (await doListTables(queryFunc)).filter(
    ({ name }: { name: string }) => !name.startsWith("_sc_") && name !== "users"
  );
};

/**
 *
 * @param queryFunc
 * @returns
 */
export const doListScTables = async (queryFunc: any) => {
  return (await doListTables(queryFunc)).filter(({ name }: { name: string }) =>
    name.startsWith("_sc_")
  );
};
