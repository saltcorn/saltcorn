/**
 * This is the sqlite-common module
 * It contains utils for "@saltcorn/sqlite" and "@saltcorn/sqlite-mobile"
 * @module
 */
import { Row, sqlsanitize, Value } from "./internal";

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
