/**
 * This is the sqlite-cordova module
 * @module
 */

import {
  Row,
  sqlsanitize,
  Where,
  SelectOptions,
  mkWhere,
  mkSelectOptions,
} from "@saltcorn/db-common/internal";
import { buildInsertSql } from "@saltcorn/db-common/sqlite-commons";

declare let window: any;

let connobj: any = null;
let db: any = null;

/**
 *
 * @param connobjPara
 */
export const setConnectionObject = (connobjPara: any): void => {
  connobj = connobjPara;
};

/**
 *
 */
export const init = () => {
  db = window.sqlitePlugin.openDatabase({
    name: connobj?.sqlite_db_name || "scdb.sqlite",
    location: connobj?.sqlite_path || "default",
  });
};

/**
 *
 * @param statement
 * @param params
 * @returns
 */
export const query = (statement: string, params?: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.executeSql(
      statement,
      params,
      (results: any) => {
        if (results.rows.length === 0) return resolve([]);
        let rows = Array<any>();
        for (let i = 0; i < results.rows.length; i++)
          rows.push(results.rows.item(i));
        return resolve(rows);
      },
      (err: Error) => {
        return reject(err);
      }
    );
  });
};

/**
 *
 * @param tbl
 * @param obj
 * @param opts
 */
export const insert = async (
  tbl: string,
  obj: Row,
  opts: { noid?: boolean; ignoreExisting?: boolean } = {}
): Promise<string | void> => {
  const { sql, valList } = buildInsertSql(tbl, obj, opts);
  await query(sql, valList);
};

/**
 *
 * @param tbl
 * @param whereObj
 * @param selectopts
 * @returns
 */
export const select = async (
  tbl: string,
  whereObj: Where,
  selectopts: SelectOptions = {}
): Promise<Row[]> => {
  const { where, values } = mkWhere(whereObj, true);
  const sql = `SELECT * FROM "${sqlsanitize(tbl)}" ${where} ${mkSelectOptions(
    selectopts
  )}`;
  const tq = await query(sql, values);
  return tq;
};

/**
 *
 */
export const drop_reset_schema = () => {
  window.sqlitePlugin.deleteDatabase(
    {
      name: connobj?.sqlite_db_name || "scdb.sqlite",
      location: connobj?.sqlite_path || "default",
    },
    () => {
      db = window.sqlitePlugin.openDatabase({
        name: connobj?.sqlite_db_name || "scdb.sqlite",
        location: connobj?.sqlite_path || "default",
      });
    },
    (error: Error) => {
      console.log("drop_reset_schema: error");
      console.log(error);
    }
  );
};
