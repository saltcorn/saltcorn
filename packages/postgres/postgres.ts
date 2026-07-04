/**
 * PostgreSQL data access layer
 * @category postgres
 * @module postgres
 */
// TODO move postgresql specific to this module
import { Pool, types } from "pg";
import type { PoolClient } from "pg";
import * as copyStreams from "pg-copy-streams";
import { pipeline } from "stream/promises";
import replace from "replacestream";
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
import PlainDate from "@saltcorn/plain-date";
import tenantsModule from "@saltcorn/db-common/tenants";

types.setTypeParser(types.builtins.DATE, (d: string) =>
  d === null ? null : new PlainDate(d)
);

let getTenantSchema: () => string;
let getRequestContext: () => any;
let getConnectObject: ((connObj?: any) => any) | null = null;
export let pool: Pool | null = null;

let log_sql_enabled = false;

const quote = (s: string): string => `"${s}"`;

const ppPK = (pk?: string): string => (pk ? quote(pk) : "id");

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
 * @param {object} [vs] - any additional parameter
 */
export function sql_log(sql: string, vs?: any): void {
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
 * @param {object} [connObj = {}] - connection object
 * @returns {Promise<void>}
 */
export const changeConnection = async (
  connObj: any = Object.create(null)
): Promise<void> => {
  await close();
  pool = new Pool(getConnectObject!(connObj));
};

export const begin = async (): Promise<void> => {
  //client = await getClient();
  await query("BEGIN");
};

export const commit = async (): Promise<void> => {
  await query("COMMIT");
};

export const rollback = async (): Promise<void> => {
  await query("ROLLBACK");
};

const getMyClient = (selopts?: any) => {
  const ctx = getRequestContext();
  return selopts?.client || ctx?.client || pool;
};

/**
 * Execute Select statement
 * @param {string} tbl - table name
 * @param {object} whereObj - where object
 * @param {object} [selectopts = {}] - select options
 * @returns {Promise<*>} return rows
 */
export const select = async (
  tbl: string,
  whereObj: Where,
  selectopts: SelectOptions & { [key: string]: any } = Object.create(null)
): Promise<Row[]> => {
  const { where, values } = mkWhere(whereObj);
  const schema = selectopts.schema || getTenantSchema();
  let sql;
  if (selectopts.tree_field && !whereObj[selectopts.tree_field])
    sql = `WITH RECURSIVE _tree AS (
      SELECT ${
        selectopts.fields ? selectopts.fields.join(", ") : `*`
      }, 0 as _level
      ${selectopts.orderBy ? `, ARRAY[row_number() over (ORDER BY "${sqlsanitize(selectopts.orderBy as string)}"${selectopts.orderDesc ? " DESC" : ""})] as _sort_path` : ""}
      FROM "${schema}"."${sqlsanitize(tbl)}"
      WHERE "${selectopts.tree_field}" IS NULL ${where ? `AND ${where.replace("where ", "")}` : ""}

    UNION ALL

    SELECT ${
      selectopts.fields
        ? selectopts.fields.map((f) => `p."${f}"`).join(", ")
        : `p.*`
    }, pt._level+1
    ${selectopts.orderBy ? `, pt._sort_path || row_number() OVER (PARTITION BY p."${selectopts.tree_field}" ORDER BY p."${selectopts.orderBy}"${selectopts.orderDesc ? " DESC" : ""})` : ""}
    FROM "${schema}"."${sqlsanitize(tbl)}" p
    JOIN _tree pt ON p."${selectopts.tree_field}" = pt."${selectopts.pk_name || "id"}"
    )
    SELECT ${
      selectopts.fields ? selectopts.fields.join(", ") : `*`
    }, _level FROM _tree ${where} ${mkSelectOptions(
      selectopts.orderBy
        ? { ...selectopts, orderBy: "_sort_path", orderDesc: false }
        : selectopts,
      values,
      false
    )}`;
  else
    sql = `SELECT ${
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
export const drop_reset_schema = async (schema: string): Promise<void> => {
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
export const count = async (
  tbl: string,
  whereObj: Where,
  opts?: SelectOptions & { [key: string]: any }
): Promise<number> => {
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
WHERE  c.oid = '"${opts?.schema || getTenantSchema()}"."${sqlsanitize(tbl)}"'::regclass`;
      sql_log(sql);
      const tq = await getMyClient(opts).query(sql, []);
      const n = +tq.rows[0].int8;
      if (n && n > 10000) return n;
    } catch {
      //skip fast estimate
    }
  }

  const core_sql = `FROM "${opts?.schema || getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where}`;
  //https://pganalyze.com/blog/5mins-postgres-limited-count
  const sql = opts?.limit
    ? `SELECT count(*) AS count FROM (
  SELECT 1 ${core_sql} limit ${+opts?.limit}) limited_count`
    : `SELECT COUNT(*) ${core_sql}`;
  sql_log(sql, values);
  const tq = await getMyClient(opts).query(sql, values);

  return parseInt(tq.rows[0].count);
};

/**
 * Get version of PostgreSQL
 * @param {boolean} short - if true return short version info else full version info
 * @returns {Promise<string>} returns version
 */
export const getVersion = async (short?: boolean): Promise<string> => {
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
export const deleteWhere = async (
  tbl: string,
  whereObj: Where,
  opts: { schema?: string; client?: any } = Object.create(null)
): Promise<Row[]> => {
  const { where, values } = mkWhere(whereObj);
  const sql = `delete FROM "${opts.schema || getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" ${where}`;
  sql_log(sql, values);

  const tq = await getMyClient(opts).query(sql, values);

  return tq.rows;
};

export const truncate = async (tbl: string): Promise<Row[]> => {
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
export const insert = async (
  tbl: string,
  obj: Row,
  opts: {
    schema?: string;
    onConflictDoNothing?: boolean;
    noid?: boolean;
    pk_name?: string;
    client?: any;
  } = Object.create(null)
): Promise<any> => {
  const kvs = Object.entries(obj);
  const fnameList = kvs.map(([k, v]) => `"${sqlsanitize(k)}"`).join();
  var valPosList: string[] = [];
  var valList: any[] = [];
  const schema = opts.schema || getTenantSchema();
  const conflict = opts.onConflictDoNothing ? "on conflict do nothing " : "";
  kvs.forEach(([k, v]: [string, any]) => {
    if (v && v.next_version_by_id) {
      valList.push(v.next_version_by_id);
      valPosList.push(
        `coalesce((select max(_version) from "${schema}"."${sqlsanitize(
          tbl
        )}" where "${v.pk_name || "id"}"=$${valList.length}), 0)+1`
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
export const update = async (
  tbl: string,
  obj: Row,
  id: any,
  opts: { schema?: string; pk_name?: string; client?: any } = Object.create(
    null
  )
): Promise<void> => {
  const kvs = Object.entries(obj);
  if (kvs.length === 0) return;
  const assigns = kvs
    .map(([k, v], ix) => `"${sqlsanitize(k)}"=$${ix + 1}`)
    .join();
  let valList = kvs.map(([k, v]) => v);
  // TBD check that is correct - because in insert function opts.noid ? "*" : opts.pk_name || "id"
  //valList.push(id === "undefined"? obj[opts.pk_name]: id);
  let whereS;
  if (id && typeof id == "object") {
    let n = kvs.length + 1;
    const whereStrs: string[] = [];
    Object.keys(id).forEach((k) => {
      valList.push(id[k]);
      whereStrs.push(`"${k}"=$${n}`);
      n += 1;
    });
    whereS = whereStrs.join(" and ");
  } else {
    valList.push(id === "undefined" ? obj[opts.pk_name || "id"] : id);
    whereS = `${ppPK(opts.pk_name)}=$${kvs.length + 1}`;
  }
  const q = `update "${opts.schema || getTenantSchema()}"."${sqlsanitize(
    tbl
  )}" set ${assigns} where ${whereS}`;
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
export const updateWhere = async (
  tbl: string,
  obj: Row,
  whereObj: Where,
  opts: { client?: any } = Object.create(null)
): Promise<void> => {
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
export const selectOne = async (
  tbl: string,
  where: Where,
  selectopts: SelectOptions = Object.create(null)
): Promise<Row> => {
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
export const selectMaybeOne = async (
  tbl: string,
  where: Where,
  selectopts: SelectOptions = Object.create(null)
): Promise<Row | null> => {
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
export const getClient = async (): Promise<PoolClient> => await pool!.connect();

/**
 * Reset sequence
 * Only for PG
 * @param {string} tblname - table name
 * @returns {Promise<void>} no result
 */
export const reset_sequence = async (
  tblname: string,
  pkname: string = "id"
): Promise<void> => {
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
export const add_unique_constraint = async (
  table_name: string,
  field_names: string[]
): Promise<void> => {
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
export const drop_unique_constraint = async (
  table_name: string,
  field_names: string[]
): Promise<void> => {
  // TBD check that there are no problems with lenght of constraint name
  const sql = `alter table "${getTenantSchema()}"."${sqlsanitize(
    table_name
  )}" drop CONSTRAINT IF EXISTS "${sqlsanitize(table_name)}_${field_names
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
export const add_index = async (
  table_name: string,
  field_name: string
): Promise<void> => {
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
export const add_fts_index = async (
  table_name: string,
  field_expression: string,
  language?: string,
  disable_fts?: boolean
): Promise<void> => {
  // TBD check that there are no problems with lenght of constraint name
  //CREATE INDEX ON public.test_table USING gist
  // ((name || (cars ->> 'values') || surname) gist_trgm_ops);
  let sql;
  if (disable_fts) {
    await getMyClient().query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
    sql = `create index "${sqlsanitize(
      table_name
    )}_fts_index" on "${getTenantSchema()}"."${sqlsanitize(
      table_name
    )}" USING gist ((${field_expression}) gist_trgm_ops);`;
  } else
    sql = `create index "${sqlsanitize(
      table_name
    )}_fts_index" on "${getTenantSchema()}"."${sqlsanitize(
      table_name
    )}" USING GIN (to_tsvector('${
      language || "english"
    }', ${field_expression}));`;
  sql_log(sql);
  await getMyClient().query(sql);
};
export const drop_fts_index = async (table_name: string): Promise<void> => {
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
export const drop_index = async (
  table_name: string,
  field_name: string
): Promise<void> => {
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
export const copyFrom = async (
  fileStream: any,
  tableName: string,
  fieldNames: string[],
  client: any
): Promise<any> => {
  const sql = `COPY "${getTenantSchema()}"."${sqlsanitize(
    tableName
  )}" (${fieldNames.map(quote).join(",")}) FROM STDIN CSV HEADER`;
  sql_log(sql);

  const stream = client.query(copyStreams.from(sql));
  return await pipeline(fileStream, stream);
};

export const copyToJson = async (
  fileStream: any,
  tableName: string,
  client?: any
): Promise<any> => {
  const sql = `COPY (SELECT (row_to_json("${sqlsanitize(tableName)}".*) || ',')
  FROM "${getTenantSchema()}"."${sqlsanitize(tableName)}") TO STDOUT`;
  sql_log(sql);
  const stream = (client || getMyClient()).query(copyStreams.to(sql));

  return await pipeline(stream, replace("\\\\", "\\"), fileStream);
};

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

export const time = async (): Promise<Date> => {
  const result = await getMyClient().query("select now()");
  const row = result.rows[0];
  return new Date(row.now);
};

/**
 *
 * @returns
 */
export const listTables = async (): Promise<{ name: string }[]> => {
  const tq = await getMyClient().query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${getTenantSchema()}'`
  );
  return tq.rows.map((row: any) => {
    return { name: row.table_name };
  });
};

/**
 *
 * @returns
 */
export const listUserDefinedTables = async (): Promise<{ name: string }[]> => {
  const tq = await getMyClient().query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${getTenantSchema()}' AND table_name NOT LIKE '_sc_%'`
  );
  return tq.rows.map((row: any) => {
    return { name: row.table_name };
  });
};

/**
 *
 * @returns
 */
export const listScTables = async (): Promise<{ name: string }[]> => {
  const tq = await getMyClient().query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = '${getTenantSchema()}' AND table_name LIKE '_sc_%'`
  );
  return tq.rows.map((row: any) => {
    return { name: row.table_name };
  });
};

export const setRequestUserContext = async (client: any, isLocal = false) => {
  const reqCon = getRequestContext();
  // No request context means an internal/background operation — leave GUC unset
  // so COALESCE(…, 1) in sc_rls_elevated grants it admin-level access intentionally.
  if (!reqCon) return;
  const user = reqCon?.req?.user;
  await client.query(
    `SELECT set_config('app.current_user_id', $1, ${isLocal}), ` +
      `set_config('app.current_user_role', $2, ${isLocal})`,
    user?.id
      ? [String(user.id), String(user.role_id ?? 100)]
      : ["0", "100"]
  );
};

/* rules of using this:

- no try catch inside unless you rethrow: wouldnt roll back
- no state.refresh_*() inside: other works wouldnt see updates as they are in transactioon
     - you can use state.refresh_*(true) for update on own worker only

*/
export const withTransaction = async (
  f: (rollback: () => Promise<void>) => Promise<any>,
  onError?: (e: Error) => any
): Promise<any> => {
  const client = await getClient();
  const reqCon = getRequestContext();
  if (reqCon) {
    reqCon.client = client;
  }
  sql_log("BEGIN;");
  await client.query("BEGIN;");
  let aborted = false;
  const rollback = async () => {
    aborted = true;
    sql_log("ROLLBACK;");
    await client.query("ROLLBACK;");
  };
  try {
    await setRequestUserContext(client, true);
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
    if (onError) return onError(error as Error);
    else throw error;
  } finally {
    if (reqCon) {
      reqCon.client = null;
    }
    client.release();
  }
};

export const commitAndBeginNewTransaction = async (): Promise<void> => {
  const client = await getMyClient();
  sql_log("COMMIT;");
  await client.query("COMMIT;");
  sql_log("BEGIN;");
  await client.query("BEGIN;");
};

export const tryCatchInTransaction = async (
  f: () => Promise<any>,
  onError?: (e: Error) => any
): Promise<any> => {
  const rndid = Math.floor(Math.random() * 16777215).toString(16);
  const reqCon = getRequestContext();
  if (reqCon?.client) await query(`SAVEPOINT sp${rndid}`);
  try {
    return await f();
  } catch (error) {
    if (reqCon?.client) await query(`ROLLBACK TO SAVEPOINT sp${rndid}`);
    if (onError) return await onError(error as Error);
  } finally {
    if (reqCon?.client) await query(`RELEASE SAVEPOINT sp${rndid}`);
  }
};

/**
 * Should be used for code that is sometimes called from within a withTransaction block
 * and sometimes not.
 * @param {Function} f logic to execute
 * @param {Function} onError error handler
 * @returns
 */
export const openOrUseTransaction = async (
  f: (rollback?: () => Promise<void>) => Promise<any>,
  onError?: (e: Error) => any
): Promise<any> => {
  const reqCon = getRequestContext();
  if (reqCon?.client) return await f();
  else return await withTransaction(f, onError);
};

/**
 * Wait some time until current transaction COMMITs,
 * then open another transaction.
 * @param {Function} f logic to execute
 * @param {Function} onError error handler
 * @returns
 */
export const whenTransactionisFree = (
  f: (rollback?: () => Promise<void>) => Promise<any>,
  onError?: (e: Error) => any
): Promise<any> => {
  return new Promise((resolve, reject) => {
    // wait until transaction is free
    let counter = 0;
    const interval = setInterval(async () => {
      const reqCon = getRequestContext();
      if (!reqCon?.client) {
        clearInterval(interval);
        try {
          resolve(await withTransaction(f, onError));
        } catch (e) {
          reject(e);
        }
      }
      if (++counter > 100) {
        clearInterval(interval);
        reject(new Error("Timeout waiting for transaction to be free"));
      }
    }, 200);
  });
};

export const query = (text: string, params?: any[]): Promise<any> => {
  sql_log(text, params);
  return getMyClient().query(text, params);
};

export { mkWhere };

/**
 * Initializes internals of the the postgres module.
 * It must be called after importing the module.
 * @param getConnectObjectPara function returning the connection object
 */
export const init = (getConnectObjectPara: (connObj?: any) => any): void => {
  if (!pool) {
    getConnectObject = getConnectObjectPara;
    const connectObj = getConnectObject();
    if (connectObj) {
      pool = new Pool(connectObj);
      getTenantSchema = tenantsModule(connectObj).getTenantSchema;
      getRequestContext = tenantsModule(connectObj).getRequestContext;
    } else {
      throw new Error("Unable to retrieve a database connection object.");
    }
  }
};
