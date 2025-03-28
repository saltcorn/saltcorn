/**
 * PostgreSQL data access layer
 * @category postgres
 * @module postgres
 */
// TODO move postgresql specific to this module
const { Pool } = require("pg");
const copyStreams = require("pg-copy-streams");
const { promisify } = require("util");
const { pipeline } = require("stream/promises");
const { Transform } = require("stream");
const replace = require("replacestream");
const {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
} = require("@saltcorn/db-common/internal");

let getTenantSchema;
let getRequestContext;
let getConnectObject = null;
let pool = null;

let log_sql_enabled = false;

const quote = (s) => `"${s}"`;

const ppPK = (pk) => (pk ? quote(pk) : "id");

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
const changeConnection = async (connObj = Object.create(null)) => {
  await close();
  pool = new Pool(getConnectObject(connObj));
};

const begin = async () => {
  //client = await getClient();
  await query("BEGIN");
};

const commit = async () => {
  await query("COMMIT");
};

const rollback = async () => {
  await query("ROLLBACK");
};

const getMyClient = (selopts) => {
  return selopts?.client || getRequestContext()?.client || pool;
};

/**
 * Execute Select statement
 * @param {string} tbl - table name
 * @param {object} whereObj - where object
 * @param {object} [selectopts = {}] - select options
 * @returns {Promise<*>} return rows
 */
const select = async (tbl, whereObj, selectopts = Object.create(null)) => {
  const { where, values } = mkWhere(whereObj);
  const schema = selectopts.schema || getTenantSchema();
  const sql = `SELECT ${
    selectopts.fields ? selectopts.fields.join(", ") : `*`
  } FROM "${schema}"."${sqlsanitize(tbl)}" ${where} ${mkSelectOptions(
    selectopts,
    values,
    false
  )}`;
  sql_log(sql, values);
  const tq = await getMyClient(selectopts).query(sql, values);

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

  await getMyClient().query(sql);
};

/**
 * Get count of rows in table
 * @param {string} - tbl - table name
 * @param {object} - whereObj - where object
 * @returns {Promise<number>} count of tables
 */
const count = async (tbl, whereObj) => {
  const { where, values } = mkWhere(whereObj);
  if (!where) {
    try {
      // fast count for large table but may be stale
      // https://stackoverflow.com/questions/7943233/fast-way-to-discover-the-row-count-of-a-table-in-postgresql
      //https://www.citusdata.com/blog/2016/10/12/count-performance/
      const sql = `SELECT (CASE WHEN c.reltuples < 0 THEN NULL
             WHEN c.relpages = 0 THEN float8 '0'  -- empty table
             ELSE c.reltuples / c.relpages END
     * (pg_catalog.pg_relation_size(c.oid)
      / pg_catalog.current_setting('block_size')::int)
       )::bigint
FROM   pg_catalog.pg_class c
WHERE  c.oid = '"${getTenantSchema()}"."${sqlsanitize(tbl)}"'::regclass`;
      sql_log(sql);
      const tq = await getMyClient().query(sql, []);
      const n = +tq.rows[0].int8;
      if (n && n > 10000) return n;
    } catch {
      //skip fast estimate
    }
  }

  const sql = `SELECT COUNT(*) FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where}`;
  sql_log(sql, values);
  const tq = await getMyClient().query(sql, values);

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
  const tq = await getMyClient().query(sql);
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
const deleteWhere = async (tbl, whereObj, opts = Object.create(null)) => {
  const { where, values } = mkWhere(whereObj);
  const sql = `delete FROM "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where}`;
  sql_log(sql, values);

  const tq = await getMyClient(opts).query(sql, values);

  return tq.rows;
};

const truncate = async (tbl) => {
  const sql = `truncate "${getTenantSchema()}"."${sqlsanitize(tbl)}"`;
  sql_log(sql, []);

  const tq = await getMyClient().query(sql, []);

  return tq.rows;
};

/**
 * Insert rows into table
 * @param {string} tbl - table name
 * @param {object} obj - columns names and data
 * @param {object} [opts = {}] - columns attributes
 * @returns {Promise<string>} returns primary key column or Id column value. If primary key column is not defined then return value of Id column.
 */
const insert = async (tbl, obj, opts = Object.create(null)) => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  var valPosList = [];
  var valList = [];
  const schema = opts.schema || getTenantSchema();
  const conflict = opts.onConflictDoNothing ? "on conflict do nothing " : "";
  kvs.forEach(([k, v]) => {
    if (v && v.next_version_by_id) {
      valList.push(v.next_version_by_id);
      valPosList.push(
        `coalesce((select max(_version) from "${schema}"."${sqlsanitize(
          tbl
        )}" where id=$${valList.length}), 0)+1`
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
        )}"(${fnameList}) values(${valPosList.join()}) ${conflict}returning ${
          opts.noid ? "*" : ppPK(opts.pk_name)
        }`
      : `insert into "${schema}"."${sqlsanitize(
          tbl
        )}" DEFAULT VALUES returning ${opts.noid ? "*" : ppPK(opts.pk_name)}`;
  sql_log(sql, valList);
  const { rows } = await getMyClient(opts).query(sql, valList);
  if (opts.noid) return;
  else if (conflict && rows.length === 0) return;
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
const update = async (tbl, obj, id, opts = Object.create(null)) => {
  const kvs = Object.entries(obj);
  if (kvs.length === 0) return;
  const assigns = kvs
    .map(([k, v], ix) => `"${sqlsanitize(k)}"=$${ix + 1}`)
    .join();
  let valList = kvs.map(([k, v]) => v);
  // TBD check that is correct - because in insert function opts.noid ? "*" : opts.pk_name || "id"
  //valList.push(id === "undefined"? obj[opts.pk_name]: id);
  valList.push(id === "undefined" ? obj[opts.pk_name || "id"] : id);
  const q = `update "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" set ${assigns} where ${ppPK(opts.pk_name)}=$${kvs.length + 1}`;
  sql_log(q, valList);
  await getMyClient(opts).query(q, valList);
};

/**
 * Update table records
 * @param {string} tbl - table name
 * @param {object} obj - columns names and data
 * @param {object} whereObj - where object
 * @param {object} opts - can contain a db client for transactions
 * @returns {Promise<void>} no result
 */
const updateWhere = async (tbl, obj, whereObj, opts = Object.create(null)) => {
  const kvs = Object.entries(obj);
  if (kvs.length === 0) return;
  const { where, values } = mkWhere(whereObj, false, kvs.length);
  const assigns = kvs
    .map(([k, v], ix) => `"${sqlsanitize(k)}"=$${ix + 1}`)
    .join();
  let valList = [...kvs.map(([k, v]) => v), ...values];

  const q = `update "${getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" set ${assigns} ${where}`;
  sql_log(q, valList);
  await getMyClient().query(q, valList);
};

/**
 * Select one record
 * @param {srting} tbl - table name
 * @param {object} where - where object
 * @param {object} [selectopts = {}] - select options
 * @returns {Promise<object>} return first record from sql result
 * @throws {Error}
 */
const selectOne = async (tbl, where, selectopts = Object.create(null)) => {
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
const selectMaybeOne = async (tbl, where, selectopts = Object.create(null)) => {
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
const reset_sequence = async (tblname, pkname = "id") => {
  const sql = `SELECT setval(pg_get_serial_sequence('"${getTenantSchema()}"."${sqlsanitize(
    tblname
  )}"', '${pkname}'), coalesce(max("${pkname}"),0) + 1, false) FROM "${getTenantSchema()}"."${sqlsanitize(
    tblname
  )}";`;
  await getMyClient().query(sql);
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
  await getMyClient().query(sql);
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
  await getMyClient().query(sql);
};

/**
 * Add index
 * @param {string} table_name - table name
 * @param {string} field_name - list of columns (members of constraint)
 * @returns {Promise<void>} no result
 */
const add_index = async (table_name, field_name) => {
  // TBD check that there are no problems with lenght of constraint name
  const sql = `create index "${sqlsanitize(table_name)}_${sqlsanitize(
    field_name
  )}_index" on "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}" ("${sqlsanitize(field_name)}");`;
  sql_log(sql);
  await getMyClient().query(sql);
};

/**
 * Add Full-text search index
 * @param {string} table_name - table name
 * @param {string} field_name - list of columns (members of constraint)
 * @returns {Promise<void>} no result
 */
const add_fts_index = async (table_name, field_expression, language) => {
  // TBD check that there are no problems with lenght of constraint name
  const sql = `create index "${sqlsanitize(
    table_name
  )}_fts_index" on "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}" USING GIN (to_tsvector('${
    language || "english"
  }', ${field_expression}));`;
  sql_log(sql);
  await getMyClient().query(sql);
};
const drop_fts_index = async (table_name) => {
  // TBD check that there are no problems with lenght of constraint name
  const sql = `drop index "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}_fts_index";`;
  sql_log(sql);
  await getMyClient().query(sql);
};

/**
 * Add index
 * @param {string} table_name - table name
 * @param {string} field_name - list of columns (members of constraint)
 * @returns {Promise<void>} no result
 */
const drop_index = async (table_name, field_name) => {
  // TBD check that there are no problems with lenght of constraint name
  const sql = `drop index "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}_${sqlsanitize(field_name)}_index";`;
  sql_log(sql);
  await getMyClient().query(sql);
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
  const sql = `COPY "${getTenantSchema()}"."${sqlsanitize(
    tableName
  )}" (${fieldNames.map(quote).join(",")}) FROM STDIN CSV HEADER`;
  sql_log(sql);

  const stream = client.query(copyStreams.from(sql));
  return await pipeline(fileStream, stream);
};

const copyToJson = async (fileStream, tableName, client) => {
  const sql = `COPY (SELECT (row_to_json("${sqlsanitize(tableName)}".*) || ',')
  FROM "${getTenantSchema()}"."${sqlsanitize(tableName)}") TO STDOUT`;
  sql_log(sql);
  const stream = (client || getMyClient()).query(copyStreams.to(sql));

  return await pipeline(stream, replace("\\\\", "\\"), fileStream);
};

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

const time = async () => {
  const result = await getMyClient().query("select now()");
  const row = result.rows[0];
  return new Date(row.now);
};

/**
 *
 * @returns
 */
const listTables = async () => {
  const tq = await getMyClient().query(
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
  const tq = await getMyClient().query(
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
  const tq = await getMyClient().query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${getTenantSchema()}' AND table_name LIKE '_sc_%'`
  );
  return tq.rows.map((row) => {
    return { name: row.table_name };
  });
};

/* rules of using this:

- no try catch inside unless you rethrow: wouldnt roll back
- no state.refresh_*() inside: other works wouldnt see updates as they are in transactioon
     - you can use state.refresh_*(true) for update on own worker only

*/
const withTransaction = async (f, onError) => {
  const client = await getClient();
  const reqCon = getRequestContext();
  if (reqCon)
    //if not, probably in a test
    reqCon.client = client;
  sql_log("BEGIN;");
  await client.query("BEGIN;");
  let aborted = false;
  const rollback = async () => {
    aborted = true;
    sql_log("ROLLBACK;");
    await client.query("ROLLBACK;");
  };
  try {
    const result = await f(rollback);

    if (!aborted) {
      sql_log("COMMIT;");
      await client.query("COMMIT;");
    }
    return result;
  } catch (error) {
    if (!aborted) {
      sql_log("ROLLBACK;");
      await client.query("ROLLBACK;");
    }
    if (onError) return onError(error);
    else throw error;
  } finally {
    if (reqCon) reqCon.client = null;
    client.release();
  }
};

const query = (text, params) => {
  sql_log(text, params);
  return getMyClient().query(text, params);
};

const postgresExports = {
  pool,
  /**
   * @param {string} text
   * @param {object} params
   * @returns {object}
   */
  query,
  begin,
  commit,
  rollback,
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
  drop_fts_index,
  getClient,
  mkWhere,
  drop_reset_schema,
  add_unique_constraint,
  drop_unique_constraint,
  add_index,
  add_fts_index,
  drop_index,
  reset_sequence,
  getVersion,
  copyFrom,
  copyToJson,
  slugify,
  time,
  listTables,
  listScTables,
  listUserDefinedTables,
  truncate,
  withTransaction,
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
      getRequestContext = require("@saltcorn/db-common/tenants")(
        connectObj
      ).getRequestContext;
      postgresExports.pool = pool;
    } else {
      throw new Error("Unable to retrieve a database connection object.");
    }
  }
  return postgresExports;
};
