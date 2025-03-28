/**
 * SQLite3 data access layer
 * @category sqlite
 * @module sqlite
 */

import { Database, verbose } from "sqlite3";
verbose();
import { unlink } from "fs/promises";

import {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
} from "@saltcorn/db-common/internal";

import type {
  Value,
  Where,
  SelectOptions,
  Row,
} from "@saltcorn/db-common/internal";

import {
  buildInsertSql,
  mkVal,
  doCount,
  doDeleteWhere,
  doListTables,
  doListUserDefinedTables,
  doListScTables,
  do_add_index,
  do_drop_index,
} from "@saltcorn/db-common/sqlite-commons";

let sqliteDatabase: Database | null = null;
let connectObj: any = null;
let current_filepath: string;

/**
 * Initializes internals of the the sqlite module.
 * It must be called after importing the module.
 * @function
 * @param {any} getConnectObject
 */
export const init = (getConnectObject: () => Database): void => {
  if (!sqliteDatabase) {
    connectObj = getConnectObject();
    current_filepath = get_db_filepath();
    sqliteDatabase = new Database(current_filepath);
    query("PRAGMA foreign_keys = ON;");
  }
};

/**
 * Get sqlite path
 * @function
 * @returns {string|void}
 */
export const get_db_filepath = (): string => {
  if (connectObj.sqlite_path) return connectObj.sqlite_path;
  return "";
};

let log_sql_enabled = false;

/**
 * Control Logging sql statements to console
 * @param {boolean} [val = true] - if true then log sql statements to console
 */
export function set_sql_logging(val: boolean = true): void {
  log_sql_enabled = val;
}

/**
 * Get sql logging state
 * @returns {boolean} if true then sql logging eabled
 */
export function get_sql_logging(): boolean {
  return log_sql_enabled;
}

/**
 * Log SQL statement to console
 * @param {string} sql - SQL statement
 * @param {any} [vs] - any additional parameter
 */
export function sql_log(sql: string, vs?: Value[]) {
  if (log_sql_enabled)
    if (typeof vs === "undefined") console.log(sql);
    else console.log(sql, vs);
}

/**
 * @param {string} sql
 * @param {any} params
 * @returns {Promise<object>}
 */
export function query(sql: string, params?: Value[]): Promise<any> {
  sql_log(sql, params);
  return new Promise((resolve, reject) => {
    if (!sqliteDatabase) {
      reject(new Error("The database connection is closed."));
      return;
    }
    sqliteDatabase.all(sql, params, function (err: any, rows: any) {
      if (err) {
        reject(err);
      } else {
        resolve({ rows });
      }
    });
  });
}

/**
 * Change connection (close connection and open new connection from connObj)
 * @param {any} connObj - connection object
 * @returns {Promise<void>}
 * @function
 */
export const changeConnection = async (connObj: any): Promise<void> => {
  if (!sqliteDatabase) {
    throw new Error("The database connection is closed.");
  }
  await sqliteDatabase.close();
  current_filepath = connObj.sqlite_path;
  sqliteDatabase = new Database(current_filepath);
};

/**
 * start a transaction
 * just an equivalent for the pg function
 */
export const begin = async () => {
  await query(`BEGIN`);
};

/**
 * commit a transaction
 * just an equivalent for the pg function
 */
export const commit = async () => {
  await query(`COMMIT`);
};

/**
 * rollback a
 * just an equivalent for the pg function
 */
export const rollback = async () => {
  await query(`ROLLBACK`);
};

/**
 * Close database connection
 * @returns {Promise<void>}
 * @function
 */
export const close = async (): Promise<void> => {
  if (!sqliteDatabase) {
    throw new Error("The database connection is closed.");
  }
  await sqliteDatabase.close();
  sqliteDatabase = null;
};

/**
 * Execute Select statement
 * @param {string} tbl - table name
 * @param {any} whereObj - where object
 * @param {any} [selectopts = {}] - select options
 * @returns {Promise<*>} return rows
 * @function
 */
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
 * @param name
 */
export const dropTable = async (name: string) => {
  await query(`DROP TABLE ${name}`);
};

/**
 *
 * @param tables
 */
export const dropTables = async (tables: string[]) => {
  for (const table of tables) {
    await dropTable(table);
  }
};

// TODO Utility function - needs ti be moved out this module

/**
 * Drop unique constraint
 * @param {string} tbl - table name
 * @param {any} obj - list of column=value pairs
 * @param {string} id - primary key column value
 * @returns {Promise<void>} no results
 * @function
 */
export const update = async (
  tbl: string,
  obj: Row,
  id: string | number
): Promise<void> => {
  const kvs = Object.entries(obj);
  if (kvs.length === 0) return;
  const assigns = kvs.map(([k, v], ix) => `"${sqlsanitize(k)}"=?`).join();
  let valList = kvs.map(([k, v]) => mkVal([k, v]));
  valList.push(id);
  const q = `update "${sqlsanitize(tbl)}" set ${assigns} where id=?`;
  await query(q, valList);
};

export const updateWhere = async (
  tbl: string,
  obj: Row,
  whereObj: Where
): Promise<void> => {
  const kvs = Object.entries(obj);
  if (kvs.length === 0) return;
  const { where, values } = mkWhere(whereObj, true, kvs.length);
  const assigns = kvs.map(([k, v], ix) => `"${sqlsanitize(k)}"=?`).join();
  let valList = [...kvs.map(([k, v]) => mkVal([k, v])), ...values];
  const q = `update "${sqlsanitize(tbl)}" set ${assigns} ${where}`;
  await query(q, valList);
};
/**
 * Delete rows in table
 * @param {string} tbl - table name
 * @param {any} whereObj - where object
 * @returns {Promise<void>} result of delete execution
 * @function
 */
export const deleteWhere = async (
  tbl: string,
  whereObj: Where
): Promise<void> => {
  await doDeleteWhere(tbl, whereObj, query);
};

/**
 * Insert rows into table
 * @param {string} tbl - table name
 * @param {any} obj - columns names and data
 * @param {any} [opts = {}] - columns attributes
 * @returns {Promise<string|void>} returns id.
 * @function
 */
export const insert = async (
  tbl: string,
  obj: Row,
  opts: { noid?: boolean; ignoreExisting?: boolean } = {}
): Promise<string | void> => {
  const { sql, valList } = buildInsertSql(tbl, obj, opts);
  await query(sql, valList);
  if (opts.noid) return;
  // TBD Support of primary key column different from id
  const ids = await query("SELECT last_insert_rowid() as id");
  return ids.rows[0].id;
};

/**
 * Select one record
 * @param {string} tbl - table name
 * @param {any} where - where object
 * @param {any} [selectopts = {}] - select options
 * @throws {Error}
 * @returns {Promise<any>} return first record from sql result
 * @function
 */
export const selectOne = async (
  tbl: string,
  where: Where,
  selectopts: SelectOptions = {}
): Promise<Row> => {
  const rows = await select(tbl, where, { ...selectopts, limit: 1 });
  if (rows.length === 0) {
    const w = mkWhere(where, true);
    throw new Error(`no ${tbl} ${w.where} are ${w.values}`);
  } else return rows[0];
};

/**
 * Select one record or null if no records
 * @param {string} tbl - table name
 * @param {any} where - where object
 * @param {any} [selectopts = {}] - select options
 * @returns {Promise<any>} - null if no record or first record data
 * @function
 */
export const selectMaybeOne = async (
  tbl: string,
  where: Where,
  selectopts: SelectOptions = {}
): Promise<Row | null> => {
  const rows = await select(tbl, where, { ...selectopts, limit: 1 });
  if (rows.length === 0) return null;
  else return rows[0];
};

/**
 * Get count of rows in table
 * @param {string} tbl - table name
 * @param {any} whereObj - where object
 * @returns {Promise<number>} count of tables
 * @function
 */
export const count = async (tbl: string, whereObj: Where) => {
  return await doCount(tbl, whereObj, query);
};

/**
 * Get version of PostgreSQL
 * @returns {Promise<string>} returns version
 * @function
 */
export const getVersion = async (): Promise<string> => {
  const sql = `SELECT sqlite_version();`;
  sql_log(sql);
  const tq = await query(sql);
  return tq.rows[0]["sqlite_version()"];
};

/**
 * Reset DB Schema using drop schema and recreate it.
 * Attention! You will lost data after call this function!
 * @returns {Promise<void>} no result
 * @function
 */
export const drop_reset_schema = async (): Promise<void> => {
  if (!sqliteDatabase) {
    throw new Error("The database connection is closed.");
  }
  await sqliteDatabase.close();
  await unlink(current_filepath);
  sqliteDatabase = new Database(current_filepath);
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
  await do_add_index(table_name, field_names, query, true, sql_log);
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
  await do_drop_index(table_name, field_names, query, true, sql_log);
};

/**
 * Add index
 * @param table_name - table name
 * @param field_name - column name
 * @returns no result
 */
export const add_index = async (
  table_name: string,
  field_name: string
): Promise<void> => {
  await do_add_index(table_name, [field_name], query, false, sql_log);
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
  await do_drop_index(table_name, [field_name], query, false, sql_log);
};

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/\s+/g, "-");

export const withTransaction = async (f: Function, onError: Function) => {
  //await query("BEGIN;");
  let aborted = false;
  const rollback = async () => {
    aborted = true;
    //await query("ROLLBACK;");
  };
  try {
    const result = await f(rollback);
    //if (!aborted) await query("COMMIT;");
    return result;
  } catch (error) {
    //if (!aborted) await query("ROLLBACK;");
    if (onError) return onError(error);
    else throw error;
  }
};
