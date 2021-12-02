/**
 * PostgreSQL data access layer
 * @category postgres
 * @module postgres
 */
import {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
} from "@saltcorn/db-common/internal";
  
import { from } from "pg-copy-streams";
import { pipeline } from "stream";
import { Pool } from "pg";
import { promisify } from "util";

let getTenantSchema: any;
let getConnectObject: any = null;
let pool: Pool | null = null;

let log_sql_enabled = false;

const closedErrorMsg = "The database connection is closed.";

/**
 * Initializes internals of the the postgres module.
 * It must be called after importing.
 * @function
 * @param {any} getConnectObjectPara 
 */
export const init = (getConnectObjectPara: () => any): void => {
  if (!pool) {
    getConnectObject = getConnectObjectPara;
    const connectObj = getConnectObject();
    if (connectObj) {
      pool = new Pool(connectObj);
      getTenantSchema = require("@saltcorn/db-common/tenants")(connectObj)
        .getTenantSchema;
    } else {
      throw new Error("Unable to retrieve a database connection object.");
    }
  }
};

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
 * @param {any[]} [vs] - any additional parameter
 */
export function sql_log(sql: string, vs?: any[]): void {
  if (log_sql_enabled)
    if (typeof vs === "undefined") console.log(sql);
    else console.log(sql, vs);
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
export const close = async (): Promise<void> => {
  if (pool) await pool.end();
  pool = null;
};

/**
 * Change connection (close connection and open new connection from connObj)
 * @param {any} [connObj = {}] - connection object
 * @returns {Promise<void>}
 */
export const changeConnection = async (connObj: any = {}): Promise<void> => {
  await close();
  pool = new Pool(getConnectObject(connObj));
};

/**
 * Execute Select statement
 * @param {string} tbl - table name
 * @param {any} whereObj - where object
 * @param {any} [selectopts = {}] - select options
 * @returns {Promise<*>} return rows
 */
export const select = async (tbl: string, whereObj: any, selectopts: any = {}): Promise<any[]> => {
  if (!pool) throw new Error(closedErrorMsg);
  const { where, values } = mkWhere(whereObj, false);
  const sql = `SELECT * FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where} ${mkSelectOptions(selectopts)}`;
  sql_log(sql, values);
  const tq = await pool.query(sql, values);

  return tq.rows;
};

/**
 * Reset DB Schema using drop schema and recreate it
 * Atterntion! You will lost data after call this function!
 * @param {string} schema - db schema name
 * @returns {Promise<void>} no result
 */
export const drop_reset_schema = async (schema: string): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  const sql = `DROP SCHEMA IF EXISTS "${schema}" CASCADE;
  CREATE SCHEMA "${schema}";
  GRANT ALL ON SCHEMA "${schema}" TO postgres;
  GRANT ALL ON SCHEMA "${schema}" TO "public" ;
  COMMENT ON SCHEMA "${schema}" IS 'standard public schema';`;
  sql_log(sql);

  await pool.query(sql);
};

/**
 * Get count of rows in table
 * @param {string} - tbl - table name
 * @param {any} - whereObj - where object
 * @returns {Promise<number>} count of tables
 */
export const count = async (tbl: string, whereObj: any): Promise<number> => {
  if (!pool) throw new Error(closedErrorMsg);
  const { where, values } = mkWhere(whereObj, false);
  const sql = `SELECT COUNT(*) FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where}`;
  sql_log(sql, values);
  const tq = await pool.query(sql, values);

  return parseInt(tq.rows[0].count);
};

/**
 * Get version of PostgreSQL
 * @param {boolean} short - if true return short version info else full version info
 * @returns {Promise<string>} returns version
 */
export const getVersion = async (short: boolean): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  const sql = `SELECT version();`;
  sql_log(sql);
  const tq = await pool.query(sql);
  const v = tq.rows[0].version;
  if (short) {
    const ws = v.split(" ");
    return ws[1];
  }
  return v;
};

/**
 * Delete rows in table
 * @param {string} tbl - table name
 * @param {any} whereObj - where object
 * @param {any} [opts = {}]
 * @returns {Promise<any[]>} result of delete execution
 */
export const deleteWhere = async (tbl: string, whereObj: any, opts: any = {}): Promise<any> => {
  const { where, values } = mkWhere(whereObj, false);
  const sql = `delete FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where}`;
  sql_log(sql, values);

  const tq = await (opts.client || pool).query(sql, values);

  return tq.rows;
};

/**
 * Insert rows into table
 * @param {string} tbl - table name
 * @param {any} obj - columns names and data
 * @param {any} [opts = {}] - columns attributes
 * @returns {Promise<string|void>} returns primary key column or Id column value. If primary key column is not defined then return value of Id column.
 */
export const insert = async (tbl: string, obj: any, opts: any = {}): Promise<string | void> => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  var valPosList = Array<string>();
  var valList = Array<any>();
  const schema = getTenantSchema();
  kvs.forEach(([k, v]: [any, any]) => {
    if (v && v.next_version_by_id) {
      valPosList.push(
        `coalesce((select max(_version) from "${schema}"."${sqlsanitize(
          tbl
        )}" where id=${+v.next_version_by_id}), 0)+1`
      );
    } else {
      valList.push(v);
      valPosList.push(`$${valList.length}`);
    }
  });
  const sql =
    valPosList.length > 0
      ? `insert into "${schema}"."${sqlsanitize(
        tbl
      )}"(${fnameList}) values(${valPosList.join()}) returning ${opts.noid ? "*" : opts.pk_name || "id"
      }`
      : `insert into "${schema}"."${sqlsanitize(
        tbl
      )}" DEFAULT VALUES returning ${opts.noid ? "*" : opts.pk_name || "id"}`;
  sql_log(sql, valList);
  const { rows } = await (opts.client || pool).query(sql, valList);
  if (opts.noid) return;
  else return rows[0][opts.pk_name || "id"];
};

/**
 * Update table records
 * @param {string} tbl - table name
 * @param {any} obj - columns names and data
 * @param {string|undefined} id - id of record (primary key column value)
 * @param {any} [opts = {}] - columns attributes
 * @returns {Promise<void>} no result
 */
export const update = async (tbl: string, obj: any, id: string, opts: any = {}): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  const kvs = Object.entries(obj);
  const assigns = kvs
    .map(([k, v], ix) => `"${sqlsanitize(k)}"=$${ix + 1}`)
    .join();
  let valList = kvs.map(([k, v]) => v);
  // TBD check that is correct - because in insert function opts.noid ? "*" : opts.pk_name || "id"
  //valList.push(id === "undefined"? obj[opts.pk_name]: id);
  valList.push(id === "undefined" ? obj[opts.pk_name || "id"] : id);
  const q = `update "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" set ${assigns} where ${opts.pk_name || "id"}=$${kvs.length + 1}`;
  sql_log(q, valList);
  await pool.query(q, valList);
};

/**
 * Update table records
 * @param {string} tbl - table name
 * @param {any} obj - columns names and data
 * @param {any} whereObj - where object
 * @returns {Promise<void>} no result
 */
export const updateWhere = async (tbl: string, obj: any, whereObj: any): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  const kvs = Object.entries(obj);
  const { where, values } = mkWhere(whereObj, false, kvs.length);
  const assigns = kvs
    .map(([k, v], ix) => `"${sqlsanitize(k)}"=$${ix + 1}`)
    .join();
  let valList = [...kvs.map(([k, v]) => v), ...values];

  const q = `update "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" set ${assigns} ${where}`;
  sql_log(q, valList);
  await pool.query(q, valList);
};

/**
 * Select one record
 * @param {srting} tbl - table name
 * @param {any} where - where object
 * @returns {Promise<object>} return first record from sql result
 * @throws {Error}
 */
export const selectOne = async (tbl: string, where: any): Promise<any> => {
  const rows = await select(tbl, where);
  if (rows.length === 0) {
    const w = mkWhere(where, false);
    throw new Error(`no ${tbl} ${w.where} are ${w.values}`);
  } else return rows[0];
};

/**
 * Select one record or null if no records
 * @param {string} tbl - table name
 * @param {any} where - where object
 * @returns {Promise<null|object>} - null if no record or first record data
 */
export const selectMaybeOne = async (tbl: string, where: any): Promise<any> => {
  const rows = await select(tbl, where);
  if (rows.length === 0) return null;
  else return rows[0];
};

/**
 * Open db connection
 * Only for PG.
 * @returns {Promise<any>} db connection object
 */
// TBD Currently this function supported only for PG
export const getClient = async (): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  return await pool.connect();
}


/**
 * Reset sequence
 * Only for PG
 * @param {string} tblname - table name
 * @returns {Promise<void>} no result
 */
export const reset_sequence = async (tblname: string): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  const sql = `SELECT setval(pg_get_serial_sequence('"${getTenantSchema()}"."${sqlsanitize(
    tblname
  )}"', 'id'), coalesce(max(id),0) + 1, false) FROM "${getTenantSchema()}"."${sqlsanitize(
    tblname
  )}";`;
  await pool.query(sql);
};

/**
 * Add unique constraint
 * @param {string} table_name - table name
 * @param {string[]} field_names - list of columns (members of constraint)
 * @returns {Promise<void>} no result
 */
export const add_unique_constraint = async (table_name: string, field_names: string[]): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  // TBD check that there are no problems with lenght of constraint name
  const sql = `alter table "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}" add CONSTRAINT "${sqlsanitize(table_name)}_${field_names
    .map((f) => sqlsanitize(f))
    .join("_")}_unique" UNIQUE (${field_names
      .map((f) => `"${sqlsanitize(f)}"`)
      .join(",")});`;
  sql_log(sql);
  await pool.query(sql);
};

/**
 * Drop unique constraint
 * @param {string} table_name - table name
 * @param {string[]} field_names - list of columns (members of constraint)
 * @returns {Promise<void>} no results
 */
export const drop_unique_constraint = async (table_name: string, field_names: string[]): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  // TBD check that there are no problems with lenght of constraint name
  const sql = `alter table "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}" drop CONSTRAINT "${sqlsanitize(table_name)}_${field_names
    .map((f) => sqlsanitize(f))
    .join("_")}_unique";`;
  sql_log(sql);
  await pool.query(sql);
};

/**
 * Copy data from CSV to table?
 * Only for PG
 * @param {any} fileStream - file stream
 * @param {string} tableName - table name
 * @param {string[]} fieldNames - list of columns
 * @param {any} client - db connection
 * @returns {Promise<function>} new Promise
 */
const copyFrom1 = (fileStream: any, tableName: string, fieldNames: string[], client: any): Promise<void> => {
  // TBD describe difference between CopyFrom and CopyFrom1
  const quote = (s:string) => `"${s}"`;
  const sql = `COPY "${sqlsanitize(tableName)}" (${fieldNames
    .map(quote)
    .join(",")}) FROM STDIN CSV HEADER`;
  sql_log(sql);

  var stream = client.query(from(sql));

  return new Promise((resolve, reject) => {
    fileStream.on("error", reject);
    stream.on("error", reject);
    stream.on("finish", resolve);
    fileStream.pipe(stream).on("error", reject);
  });
};

/**
 * Copy data from CSV to table?
 * Only for PG
 * @param {any} fileStream - file stream
 * @param {string} tableName - table name
 * @param {string[]} fieldNames - list of columns
 * @param {any} client - db connection
 * @returns {Promise<any>} no results
 */
export const copyFrom = async (fileStream: any, tableName: string, fieldNames: string[], client: any): Promise<any> => {
  if (!pool) throw new Error(closedErrorMsg);
  // TBD describe difference between CopyFrom and CopyFrom1
  const quote = (s:string) => `"${s}"`;
  const sql = `COPY "${sqlsanitize(tableName)}" (${fieldNames
    .map(quote)
    .join(",")}) FROM STDIN CSV HEADER`;
  sql_log(sql);

  const stream = client.query(from(sql));
  return await promisify(pipeline)(fileStream, stream);
};

/**
 * @param {string} text
 * @param {any} params
 * @returns {any}
 */
export const query = (text: string, params: any): any => {
  if (!pool) throw new Error(closedErrorMsg);
  sql_log(text, params);
  return pool.query(text, params);
};
