/**
 * @category db-common
 * @module internal
 */

//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
/**
 * Transform value to correct sql name.
 * Note! Dont use other symbols than ^A-Za-z_0-9
 * @function
 * @param {string} nm
 * @returns {string}
 */
export const sqlsanitize = (nm: string | symbol): string => {
  if (typeof nm === "symbol") {
    return nm.description ? sqlsanitize(nm.description) : "";
  }
  const s = nm.replace(/[^A-Za-z_0-9]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
};
/**
 * Transform value to correct sql name.
 * Instead of sqlsanitize also allows .
 * For e.g. table name
 * Note! Dont use other symbols than ^A-Za-z_0-9.
 * @function
 * @param {string} nm
 * @returns {string}
 */
export const sqlsanitizeAllowDots = (nm: string | symbol): string => {
  if (typeof nm === "symbol") {
    return nm.description ? sqlsanitizeAllowDots(nm.description) : "";
  }
  const s = nm.replace(/[^A-Za-z_0-9."]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
};

type Where = {
  [key: string]: any;
};

/**
 *
 * @param {object} v
 * @param {string} i
 * @param {boolean} is_sqlite
 * @returns {string}
 */
const whereFTS = (
  v: { fields: any[]; table?: string },
  i: number,
  is_sqlite: boolean
): string => {
  const { fields, table } = v;
  var flds = fields
    .filter((f: any) => f.type && f.type.sql_name === "text")
    .map(
      (f: any) =>
        "coalesce(" +
        (table
          ? `"${sqlsanitize(table)}"."${sqlsanitize(f.name)}"`
          : `"${sqlsanitize(f.name)}"`) +
        ",'')"
    )
    .join(" || ' ' || ");
  if (flds === "") flds = "''";
  if (is_sqlite) return `${flds} LIKE '%' || ? || '%'`;
  else
    return `to_tsvector('english', ${flds}) @@ plainto_tsquery('english', $${i})`;
};

/**
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {string}
 */
const placeHolder = (is_sqlite: boolean, i: number): string =>
  is_sqlite ? `?` : `$${i}`;

/**
 * @returns {number}
 */
const mkCounter = (init: number = 0): (() => number) => {
  let i = init;
  return () => {
    i += 1;
    return i;
  };
};

/**
 *
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const subSelectWhere = (is_sqlite: boolean, i: () => number) => (
  k: string,
  v: { inSelect: { where: Where; field: string; table: string } }
): string => {
  const whereObj = v.inSelect.where;
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const where =
    whereObj && wheres.length > 0
      ? "where " + wheres.map(whereClause(is_sqlite, i)).join(" and ")
      : "";
  return `${quote(sqlsanitizeAllowDots(k))} in (select ${
    v.inSelect.field
  } from ${v.inSelect.table} ${where})`;
};
/**
 * @param {object} v
 * @returns {object[]}
 */
const subSelectVals = (v: { inSelect: { where: Where } }): any[] => {
  const whereObj = v.inSelect.where;
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const xs = wheres
    .map(getVal)
    .flat(1)
    .filter((v) => v !== null);
  return xs;
};
/**
 * @param {string} s
 * @returns {string}
 */
const wrapParens = (s: string): string => (s ? `(${s})` : s);
/**
 * @param {string} s
 * @returns {string}
 */
const quote = (s: string): string =>
  s.includes(".") || s.includes('"') ? s : `"${s}"`;
/**
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const whereOr = (
  is_sqlite: boolean,
  i: () => number
): ((ors: any[]) => string) => (ors: any[]): string =>
  wrapParens(
    ors
      .map((vi: any) =>
        Object.entries(vi)
          .map((kv) => whereClause(is_sqlite, i)(kv))
          .join(" and ")
      )
      .join(" or ")
  );

const equals = ([v1, v2]: [any, any], is_sqlite: boolean, i: () => number) => {
  const pVal = (v: any) =>
    typeof v === "symbol"
      ? quote(sqlsanitizeAllowDots(v))
      : placeHolder(is_sqlite, i()) + (typeof v === "string" ? "::text" : "");
  const isNull = (v: any) => `${pVal(v)} is null`;
  if (v1 === null && v2 === null) return "null is null";
  if (v1 === null) return isNull(v2);
  if (v2 === null) return isNull(v1);
  return `${pVal(v1)}=${pVal(v2)}`;
};
const equalsVals = (vs: any[]): any[] => {
  let vals = new Array<any>();

  vs.forEach((v) => {
    if (v !== null && typeof v !== "symbol") vals.push(v);
  });
  //console.log({ vals });
  return vals;
};
/**
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const whereClause = (
  is_sqlite: boolean,
  i: () => number
): (([k, v]: [string, any | [any, any]]) => string) => ([k, v]: [
  string,
  any | [any, any]
]): string =>
  k === "_fts"
    ? whereFTS(v, i(), is_sqlite)
    : typeof (v || {}).in !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))} = ${
        is_sqlite ? "" : "ANY"
      } (${placeHolder(is_sqlite, i())})`
    : k === "or" && Array.isArray(v)
    ? whereOr(is_sqlite, i)(v)
    : k === "not" && typeof v === "object"
    ? `not (${Object.entries(v)
        .map((kv) => whereClause(is_sqlite, i)(kv))
        .join(" and ")})`
    : k === "eq" && Array.isArray(v)
    ? // @ts-ignore
      equals(v, is_sqlite, i)
    : v && v.or && Array.isArray(v.or)
    ? wrapParens(
        v.or.map((vi: any) => whereClause(is_sqlite, i)([k, vi])).join(" or ")
      )
    : Array.isArray(v)
    ? v.map((vi) => whereClause(is_sqlite, i)([k, vi])).join(" and ")
    : typeof (v || {}).ilike !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))} ${
        is_sqlite ? "LIKE" : "ILIKE"
      } '%' || ${placeHolder(is_sqlite, i())} || '%'`
    : typeof (v || {}).gt !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))}>${v.equal ? "=" : ""}${placeHolder(
        is_sqlite,
        i()
      )}`
    : typeof (v || {}).lt !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))}<${v.equal ? "=" : ""}${placeHolder(
        is_sqlite,
        i()
      )}`
    : typeof (v || {}).inSelect !== "undefined"
    ? subSelectWhere(is_sqlite, i)(k, v)
    : typeof (v || {}).json !== "undefined"
    ? is_sqlite
      ? `json_extract(${quote(
          sqlsanitizeAllowDots(k)
        )}, '$.${sqlsanitizeAllowDots(v.json[0])}')=${placeHolder(
          is_sqlite,
          i()
        )}`
      : `${quote(sqlsanitizeAllowDots(k))}->>'${sqlsanitizeAllowDots(
          v.json[0]
        )}'=${placeHolder(is_sqlite, i())}`
    : v === null
    ? `${quote(sqlsanitizeAllowDots(k))} is null`
    : k === "not"
    ? `not (${
        typeof v === "symbol" ? v.description : placeHolder(is_sqlite, i())
      })`
    : `${quote(sqlsanitizeAllowDots(k))}=${
        typeof v === "symbol" ? v.description : placeHolder(is_sqlite, i())
      }`;

/**
 * @param {object[]} opts
 * @param {object} opts.k
 * @param {object} opts.v
 * @returns {boolean|object}
 */
const getVal = ([k, v]: [string, any]): any =>
  k === "_fts"
    ? v.searchTerm
    : typeof (v || {}).in !== "undefined"
    ? [v.in]
    : k === "not" && typeof v === "object"
    ? Object.entries(v).map(getVal).flat(1)
    : k === "eq" && Array.isArray(v)
    ? equalsVals(v).flat(1)
    : k === "or" && Array.isArray(v)
    ? v
        .map((vi) => Object.entries(vi).map(getVal))
        .flat(1)
        .flat(1)
    : v && v.or && Array.isArray(v.or)
    ? v.or.map((vi: any) => getVal([k, vi])).flat(1)
    : Array.isArray(v)
    ? v.map((vi) => getVal([k, vi])).flat(1)
    : typeof (v || {}).ilike !== "undefined"
    ? v.ilike
    : typeof (v || {}).inSelect !== "undefined"
    ? subSelectVals(v)
    : typeof (v || {}).lt !== "undefined"
    ? v.lt
    : typeof (v || {}).gt !== "undefined"
    ? v.gt
    : typeof (v || {}).sql !== "undefined"
    ? null
    : typeof (v || {}).json !== "undefined"
    ? v.json[1]
    : typeof v === "symbol"
    ? null
    : v;

type WhereAndVals = {
  where: string;
  values: string[];
};
/**
 * @param {object} whereObj
 * @param {boolean} is_sqlite
 * @param {number} initCount
 * @returns {object}
 */
export const mkWhere = (
  whereObj: Where,
  is_sqlite: boolean,
  initCount: number = 0
): WhereAndVals => {
  const wheres = whereObj ? Object.entries(whereObj) : [];
  //console.log({ wheres });
  const where =
    whereObj && wheres.length > 0
      ? "where " +
        wheres.map(whereClause(is_sqlite, mkCounter(initCount))).join(" and ")
      : "";
  const values = wheres
    .map(getVal)
    .flat(1)
    .filter((v) => v !== null);
  return { where, values };
};

/**
 * @param {number|string} x
 * @returns {number|null}
 */
const toInt = (x: number | string): number | null =>
  typeof x === "number"
    ? Math.round(x)
    : typeof x === "string"
    ? parseInt(x)
    : null;

type CoordOpts = {
  latField: string;
  longField: string;
  lat: string;
  long: string;
};
/**
 * @param {object} opts
 * @param {string} opts.latField
 * @param {string} opts.longField
 * @param {number} opts.lat
 * @param {number} opts.long
 * @returns {string}
 */
const getDistanceOrder = ({ latField, longField, lat, long }: CoordOpts) => {
  const cos_lat_2 = Math.pow(Math.cos((+lat * Math.PI) / 180), 2);
  return `((${sqlsanitizeAllowDots(
    latField
  )} - ${+lat})*(${sqlsanitizeAllowDots(
    latField
  )} - ${+lat})) + ((${sqlsanitizeAllowDots(
    longField
  )} - ${+long})*(${sqlsanitizeAllowDots(longField)} - ${+long})*${cos_lat_2})`;
};

/**
 * @param {object} selopts
 * @returns {string[]}
 */
export const mkSelectOptions = (selopts: any) => {
  const orderby =
    selopts.orderBy === "RANDOM()"
      ? "order by RANDOM()"
      : selopts.orderBy && selopts.orderBy.distance
      ? `order by ${getDistanceOrder(selopts.orderBy.distance)}`
      : selopts.orderBy && selopts.nocase
      ? `order by lower(${sqlsanitizeAllowDots(selopts.orderBy)})${
          selopts.orderDesc ? " DESC" : ""
        }`
      : selopts.orderBy
      ? `order by ${sqlsanitizeAllowDots(selopts.orderBy)}${
          selopts.orderDesc ? " DESC" : ""
        }`
      : "";
  const limit = selopts.limit ? `limit ${toInt(selopts.limit)}` : "";
  const offset = selopts.offset ? `offset ${toInt(selopts.offset)}` : "";
  return [orderby, limit, offset].filter((s) => s).join(" ");
};
