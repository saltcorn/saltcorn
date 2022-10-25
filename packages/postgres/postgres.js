/**
 * PostgreSQL data access layer
 * @category postgres
 * @module postgres
 */
// TODO move postgresql specific to this module
const { Pool } = require("pg");
const copyStreams = require("pg-copy-streams");
const { promisify } = require("util");
const { pipeline } = require("stream");
const {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
} = require("@saltcorn/db-common/internal");

let getTenantSchema;
let getConnectObject = null;
let pool = null;

let log_sql_enabled = false;

/**
 * Control Logging sql statements to console
 * @param {boolean} [val = true] - if true then log sql statements to console
 */
function set_sql_logging(val = true) {
  log_sql_enabled = val;
}

/**
 * Get sql logging state
 * @returns {boolean} if true then sql logging eabled
 */
function get_sql_logging() {
  return log_sql_enabled;
}

/**
 * Log SQL statement to console
 * @param {string} sql - SQL statement
 * @param {object} [vs] - any additional parameter
 */
function sql_log(sql, vs) {
  if (log_sql_enabled)
    if (typeof vs === "undefined") console.log(sql);
    else console.log(sql, vs);
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
const close = async () => {
  if (pool) await pool.end();
  pool = null;
};

/**
 * Change connection (close connection and open new connection from connObj)
 * @param {object} [connObj = {}] - connection object
 * @returns {Promise<void>}
 */
const changeConnection = async (connObj = {}) => {
  await close();
  pool = new Pool(getConnectObject(connObj));
};

/**
 * Execute Select statement
 * @param {string} tbl - table name
 * @param {object} whereObj - where object
 * @param {object} [selectopts = {}] - select options
 * @returns {Promise<*>} return rows
 */
const select = async (tbl, whereObj, selectopts = {}) => {
  const { where, values } = mkWhere(whereObj);
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
const drop_reset_schema = async (schema) => {
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
 * @param {object} - whereObj - where object
 * @returns {Promise<number>} count of tables
 */
const count = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj);
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
const getVersion = async (short) => {
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
 * @param {object} whereObj - where object
 * @param {object} [opts = {}]
 * @returns {Promise<object[]>} result of delete execution
 */
const deleteWhere = async (tbl, whereObj, opts = {}) => {
  const { where, values } = mkWhere(whereObj);
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
 * @param {object} obj - columns names and data
 * @param {object} [opts = {}] - columns attributes
 * @returns {Promise<string>} returns primary key column or Id column value. If primary key column is not defined then return value of Id column.
 */
const insert = async (tbl, obj, opts = {}) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  var valPosList = [];
  var valList = [];
  const schema = getTenantSchema();
  kvs.forEach(([k, v]) => {
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
 * @param {object} obj - columns names and data
 * @param {number|undefined} id - id of record (primary key column value)
 * @param {object} [opts = {}] - columns attributes
 * @returns {Promise<void>} no result
 */
const update = async (tbl, obj, id, opts = {}) => {
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
 * @param {object} obj - columns names and data
 * @param {object} whereObj - where object
 * @returns {Promise<void>} no result
 */
const updateWhere = async (tbl, obj, whereObj) => {
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
 * @param {object} where - where object
 * @param {object} [selectopts = {}] - select options
 * @returns {Promise<object>} return first record from sql result
 * @throws {Error}
 */
const selectOne = async (tbl, where, selectopts = {}) => {
  const rows = await select(tbl, where, { ...selectopts, limit: 1 });
  if (rows.length === 0) {
    const w = mkWhere(where);
    throw new Error(`no ${tbl} ${w.where} are ${w.values}`);
  } else return rows[0];
};

/**
 * Select one record or null if no records
 * @param {string} tbl - table name
 * @param {object} where - where object
 * @param {object} [selectopts = {}] - select options
 * @returns {Promise<null|object>} - null if no record or first record data
 */
const selectMaybeOne = async (tbl, where, selectopts = {}) => {
  const rows = await select(tbl, where, { ...selectopts, limit: 1 });
  if (rows.length === 0) return null;
  else return rows[0];
};

/**
 * Open db connection
 * Only for PG.
 * @returns {Promise<*>} db connection object
 */
// TBD Currently this function supported only for PG
const getClient = async () => await pool.connect();

/**
 * Reset sequence
 * Only for PG
 * @param {string} tblname - table name
 * @returns {Promise<void>} no result
 */
const reset_sequence = async (tblname) => {
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
const add_unique_constraint = async (table_name, field_names) => {
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
const drop_unique_constraint = async (table_name, field_names) => {
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
 * @param {object} fileStream - file stream
 * @param {string} tableName - table name
 * @param {string[]} fieldNames - list of columns
 * @param {object} client - db connection
 * @returns {Promise<function>} new Promise
 */
const copyFrom1 = (fileStream, tableName, fieldNames, client) => {
  // TBD describe difference between CopyFrom and CopyFrom1
  const quote = (s) => `"${s}"`;
  const sql = `COPY "${sqlsanitize(tableName)}" (${fieldNames
    .map(quote)
    .join(",")}) FROM STDIN CSV HEADER`;
  sql_log(sql);

  var stream = client.query(copyStreams.from(sql));

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
 * @param {object} fileStream - file stream
 * @param {string} tableName - table name
 * @param {string[]} fieldNames - list of columns
 * @param {object} client - db connection
 * @returns {Promise<void>} no results
 */
const copyFrom = async (fileStream, tableName, fieldNames, client) => {
  // TBD describe difference between CopyFrom and CopyFrom1
  const quote = (s) => `"${s}"`;
  const sql = `COPY "${sqlsanitize(tableName)}" (${fieldNames
    .map(quote)
    .join(",")}) FROM STDIN CSV HEADER`;
  sql_log(sql);

  const stream = client.query(copyStreams.from(sql));
  return await promisify(pipeline)(fileStream, stream);
};

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

/**
 *
 * @returns
 */
const listTables = async () => {
  const tq = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${getTenantSchema()}'`
  );
  return tq.rows.map((row) => {
    return { name: row.table_name };
  });
};

/**
 *
 * @returns
 */
const listUserDefinedTables = async () => {
  const tq = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${getTenantSchema()}' AND table_name NOT LIKE '_sc_%'`
  );
  return tq.rows.map((row) => {
    return { name: row.table_name };
  });
};

/**
 *
 * @returns
 */
const listScTables = async () => {
  const tq = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${getTenantSchema()}' AND table_name LIKE '_sc_%'`
  );
  return tq.rows.map((row) => {
    return { name: row.table_name };
  });
};

const postgresExports = {
  pool,
  /**
   * @param {string} text
   * @param {object} params
   * @returns {object}
   */
  query: (text, params) => {
    sql_log(text, params);
    return pool.query(text, params);
  },
  select,
  selectOne,
  selectMaybeOne,
  count,
  insert,
  update,
  updateWhere,
  deleteWhere,
  close,
  sql_log,
  changeConnection,
  set_sql_logging,
  get_sql_logging,
  getClient,
  mkWhere,
  drop_reset_schema,
  add_unique_constraint,
  drop_unique_constraint,
  reset_sequence,
  getVersion,
  copyFrom,
  slugify,
  listTables,
  listScTables,
  listUserDefinedTables,
};

module.exports = (getConnectObjectPara) => {
  if (!pool) {
    getConnectObject = getConnectObjectPara;
    const connectObj = getConnectObject();
    if (connectObj) {
      pool = new Pool(connectObj);
      getTenantSchema = require("@saltcorn/db-common/tenants")(
        connectObj
      ).getTenantSchema;
      postgresExports.pool = pool;
    } else {
      throw new Error("Unable to retrieve a database connection object.");
    }
  }
  return postgresExports;
};
