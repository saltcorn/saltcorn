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
export const reprAsJson = (v: any, jsonCol?: boolean): boolean =>
  (jsonCol && (v === true || v === false)) ||
  (typeof v === "object" && v !== null && !(v instanceof Date));

const isDate = (value: any): boolean =>
  value && Object.prototype.toString.call(value) === "[object Date]";

/**
 * @param opts
 * @param opts.k
 * @param  opts.v
 * @returns
 */
export const mkVal = ([k, v]: [string, any], jsonCol?: boolean): Value =>
  reprAsJson(v, jsonCol) ? JSON.stringify(v) : isDate(v) ? v.valueOf() : v;

/**
 * return type of buildInsertSql()
 * wraps the INSERT sql string and the values to insert
 */
export type SqlAndValues = {
  sql: string;
  valList: Array<any>;
};

/**
 * Build a INSERT INTO sql statement for one row
 * @param tbl table name
 * @param obj row to insert
 * @param opts noid, ignoreExisting, replace
 * @returns sql string and values for the placeholders
 */
export const buildInsertSql = (
  tbl: string,
  obj: Row,
  opts: {
    noid?: boolean;
    ignoreExisting?: boolean;
    replace?: boolean;
    jsonCols?: string[];
  } = {}
): SqlAndValues => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  const valPosList = kvs
    .map(([k, v], ix: any) =>
      v && v.next_version_by_id
        ? `coalesce((select max(_version) from "${sqlsanitize(
            tbl
          )}" where id=${+v.next_version_by_id}), 0)+1`
        : reprAsJson(v, opts.jsonCols?.includes(k))
        ? "json(?)"
        : "?"
    )
    .join();
  const valList = kvs
    .filter(([k, v]: [any, any]) => !(v && v.next_version_by_id))
    .map(([k, v]) => {
      return mkVal([k, v], opts.jsonCols?.includes(k));
    });
  const ignoreExisting = opts.ignoreExisting ? "or ignore" : "";
  const replace = opts.replace ? "or replace" : "";
  const sql = `insert ${ignoreExisting} ${replace} into "${sqlsanitize(
    tbl
  )}"(${fnameList}) values(${valPosList})`;

  return {
    sql: sql,
    valList: valList,
  };
};

type SqlAndValuesBulk = {
  sql: string;
  vals: string[];
};

/**
 * Build INSERT INTO sql statements for multiple rows
 * The rows are grouped by fields that are the same
 * @param tbl table name
 * @param objs rows to insert
 * @param opts noid, ignoreExisting, replace
 * @returns an array of sql strings with values for the placeholders
 */
export const buildInsertBulkSql = (
  tbl: string,
  objs: Row[],
  opts: { noid?: boolean; ignoreExisting?: boolean; replace?: boolean } = {}
): Array<SqlAndValuesBulk> => {
  const result = new Array<SqlAndValuesBulk>();
  const ignoreExisting = opts.ignoreExisting ? "or ignore" : "";
  const replace = opts.replace ? "or replace" : "";
  // group rows by fields that are the same
  const fieldsWithRows: any = {};
  for (const obj of objs) {
    const kvs = Object.entries(obj);
    const fnames = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join(",");
    const vals = kvs
      .filter(([k, v]: [any, any]) => !(v && v.next_version_by_id))
      .map(([k, v]) => mkVal([k, v]));
    if (!fieldsWithRows[fnames])
      fieldsWithRows[fnames] = {
        valPattern: `(${kvs
          .map(([k, v]) => (reprAsJson(v) ? "json(?)" : "?"))
          .join()})`,
        vals: [],
        count: 0,
      };
    fieldsWithRows[fnames].vals.push(...vals);
    fieldsWithRows[fnames].count++;
  }

  for (const [k, v] of Object.entries(fieldsWithRows)) {
    const { valPattern, vals, count } = v as any;
    const sql = `insert ${ignoreExisting} ${replace} into "${sqlsanitize(
      tbl
    )}" (${k}) values ${Array(count).fill(valPattern).join(",")}`;
    result.push({ sql, vals });
  }
  return result;
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
