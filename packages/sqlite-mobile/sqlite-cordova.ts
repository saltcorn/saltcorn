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
import {
  buildInsertSql,
  doCount,
  doDeleteWhere,
  mkVal,
  doListTables,
  doListUserDefinedTables,
  doListScTables,
} from "@saltcorn/db-common/sqlite-commons";

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
export const init = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db = window.sqlitePlugin.openDatabase(
      {
        name: connobj?.sqlite_db_name || "scdb.sqlite",
        location: connobj?.sqlite_path || "default",
        createFromLocation: 1,
      },
      resolve,
      reject
    );
  });
};

/**
 *
 * @param statement
 * @param params
 * @returns
 */
export const query = (statement: string, params?: any): Promise<any> => {
  if (params?.length) {
    /// https://github.com/storesafe/cordova-sqlite-storage/issues/545
    params = params.map((param: any) =>
      param === false ? 0 : param === true ? 1 : param
    );
  }
  return new Promise((resolve, reject) => {
    db.executeSql(
      statement,
      params,
      (results: any) => {
        let rows = Array<any>();
        for (let i = 0; i < results.rows.length; i++)
          rows.push(results.rows.item(i));
        return resolve({ rows });
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
  const ids = await query("SELECT last_insert_rowid() as id");
  return ids.rows[0].id;
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
  return tq.rows;
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

/**
 *
 * @param tbl
 * @param whereObj
 * @returns
 */
export const count = async (tbl: string, whereObj: Where) => {
  return await doCount(tbl, whereObj, query);
};

/**
 *
 * @param tbl
 * @param whereObj
 */
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
 */
export const update = async (
  tbl: string,
  obj: Row,
  id: string | number
): Promise<void> => {
  const kvs = Object.entries(obj);
  const assigns = kvs.map(([k, v], ix) => `"${sqlsanitize(k)}"=?`).join();
  let valList = kvs.map(mkVal);
  valList.push(id);
  const q = `update "${sqlsanitize(tbl)}" set ${assigns} where id=?`;
  await query(q, valList);
};

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
