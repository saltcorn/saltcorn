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

type PlaceHolderStack = {
  push: (x: Value) => string; //push value, return placeholder
  is_sqlite: boolean;
  getValues: () => Value[];
};

const postgresPlaceHolderStack = (init: number = 0): PlaceHolderStack => {
  let values: Value[] = [];
  let i = init;
  return {
    push(x) {
      values.push(x);
      i += 1;
      return `$${i}`;
    },
    is_sqlite: false,
    getValues() {
      return values;
    },
  };
};

const sqlitePlaceHolderStack = (): PlaceHolderStack => {
  let values: Value[] = [];
  return {
    push(x) {
      values.push(x);
      return `?`;
    },
    is_sqlite: true,
    getValues() {
      return values;
    },
  };
};

/**
 *
 * @param {object} v
 * @param {string} i
 * @param {boolean} is_sqlite
 * @returns {string}
 */
const whereFTS = (
  v: { fields: any[]; table?: string; searchTerm: string },
  phs: PlaceHolderStack
): string => {
  const { fields, table } = v;
  let flds = fields
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
  if (phs.is_sqlite)
    return `${flds} LIKE '%' || ${phs.push(v.searchTerm)} || '%'`;
  else
    return `to_tsvector('english', ${flds}) @@ plainto_tsquery('english', ${phs.push(
      v.searchTerm
    )})`;
};

export type Value = string | number | boolean | Date | Value[];

export type Where = {
  _fts?: { fields: any[]; table?: string; searchTerm: string };
  or?: Where[];
  not?: Where | symbol;
  eq?: Value[];
  [key: string]:
    | { in: Value[] }
    | { or: Value[] }
    | { gt: Value; equal?: boolean }
    | { lt: Value; equal?: boolean }
    | Value[]
    | { inSelect: { where: Where; field: string; table: string } }
    | null
    | symbol
    | any; // TODO Value
};

/**
 *
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const subSelectWhere = (phs: PlaceHolderStack) => (
  k: string,
  v: { inSelect: { where: Where; field: string; table: string } }
): string => {
  const whereObj = v.inSelect.where;
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const where =
    whereObj && wheres.length > 0
      ? "where " + wheres.map(whereClause(phs)).join(" and ")
      : "";
  return `${quote(sqlsanitizeAllowDots(k))} in (select ${
    v.inSelect.field
  } from ${v.inSelect.table} ${where})`;
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
  s.includes(".")
    ? s.split(".").map(quote).join(".")
    : s.includes('"')
    ? s
    : `"${s}"`;
/**
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const whereOr = (phs: PlaceHolderStack): ((ors: any[]) => string) => (
  ors: any[]
): string =>
  wrapParens(
    ors
      .map((vi: any) =>
        Object.entries(vi)
          .map((kv) => whereClause(phs)(kv))
          .join(" and ")
      )
      .join(" or ")
  );

const equals = ([v1, v2]: [any, any], phs: PlaceHolderStack) => {
  const pVal = (v: any) =>
    typeof v === "symbol"
      ? quote(sqlsanitizeAllowDots(v))
      : phs.push(v) + (typeof v === "string" ? "::text" : "");
  const isNull = (v: any) => `${pVal(v)} is null`;
  if (v1 === null && v2 === null) return "null is null";
  if (v1 === null) return isNull(v2);
  if (v2 === null) return isNull(v1);
  return `${pVal(v1)}=${pVal(v2)}`;
};
const slugifyQuery = (k: string, s: string, phs: PlaceHolderStack) =>
  phs.is_sqlite
    ? `REPLACE(LOWER(${quote(sqlsanitizeAllowDots(k))}),' ','-')=${phs.push(s)}`
    : `REGEXP_REPLACE(REPLACE(LOWER(${quote(
        sqlsanitizeAllowDots(k)
      )}),' ','-'),'[^\\w-]','','g')=${phs.push(s)}`;
/**
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const whereClause = (
  phs: PlaceHolderStack
): (([k, v]: [string, any | [any, any]]) => string) => ([k, v]: [
  string,
  any | [any, any]
]): string =>
  k === "_fts"
    ? whereFTS(v, phs)
    : typeof (v || {}).in !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))} = ${
        phs.is_sqlite ? "" : "ANY"
      } (${phs.push(v.in)})`
    : k === "or" && Array.isArray(v)
    ? whereOr(phs)(v)
    : typeof (v || {}).slugify !== "undefined"
    ? slugifyQuery(k, v.slugify, phs)
    : k === "not" && typeof v === "object"
    ? `not (${Object.entries(v)
        .map((kv) => whereClause(phs)(kv))
        .join(" and ")})`
    : k === "eq" && Array.isArray(v)
    ? // @ts-ignore
      equals(v, phs)
    : v && v.or && Array.isArray(v.or)
    ? wrapParens(v.or.map((vi: any) => whereClause(phs)([k, vi])).join(" or "))
    : Array.isArray(v)
    ? v.map((vi) => whereClause(phs)([k, vi])).join(" and ")
    : typeof (v || {}).ilike !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))} ${
        phs.is_sqlite ? "LIKE" : "ILIKE"
      } '%' || ${phs.push(v.ilike)} || '%'`
    : typeof (v || {}).gt !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))}>${v.equal ? "=" : ""}${phs.push(v.gt)}`
    : typeof (v || {}).lt !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))}<${v.equal ? "=" : ""}${phs.push(v.lt)}`
    : typeof (v || {}).inSelect !== "undefined"
    ? subSelectWhere(phs)(k, v)
    : typeof (v || {}).json !== "undefined"
    ? phs.is_sqlite
      ? `json_extract(${quote(
          sqlsanitizeAllowDots(k)
        )}, '$.${sqlsanitizeAllowDots(v.json[0])}')=${phs.push(v.json[1])}`
      : `${quote(sqlsanitizeAllowDots(k))}->>'${sqlsanitizeAllowDots(
          v.json[0]
        )}'=${phs.push(v.json[1])}`
    : v === null
    ? `${quote(sqlsanitizeAllowDots(k))} is null`
    : k === "not"
    ? `not (${typeof v === "symbol" ? v.description : phs.push(v)})`
    : `${quote(sqlsanitizeAllowDots(k))}=${
        typeof v === "symbol" ? v.description : phs.push(v)
      }`;

type WhereAndVals = {
  where: string;
  values: Value[];
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
  const placeHolderStack = is_sqlite
    ? sqlitePlaceHolderStack()
    : postgresPlaceHolderStack(initCount);
  const where =
    whereObj && wheres.length > 0
      ? "where " + wheres.map(whereClause(placeHolderStack)).join(" and ")
      : "";
  const values = placeHolderStack.getValues();
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

export type CoordOpts = {
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

export type SelectOptions = {
  orderBy?: { distance: CoordOpts } | string;
  limit?: string | number;
  offset?: string | number;
  nocase?: boolean;
  orderDesc?: boolean;
  cached?: boolean;
  versioned?: boolean;
  min_role_read?: number;
  min_role_write?: number;
  ownership_field_id?: string;
  ownership_formula?: string;
  description?: string;
};
export const orderByIsObject = (
  object: any
): object is { distance: CoordOpts } => {
  return object && object.distance;
};

export type JoinField = {
  ref: any;
  target: any;
  through: any;
  [key: string]: any;
};

export type JoinOptions = {
  joinFields?: JoinField;
  aggregations?: AggregationOptions[];
  where: any;
} & SelectOptions;

export type AggregationOptions = {
  table: string;
  ref: string;
  field: string;
  where?: Where;
  aggregate: string;
  subselect?: SubselectOptions;
};

export type SubselectOptions = {
  tableName: string;
  whereField: string;
  field: string;
  table: any; // TODO without circular deps
};

/**
 * @param {object} selopts
 * @returns {string}
 */
export const mkSelectOptions = (selopts: SelectOptions): string => {
  const orderby =
    selopts.orderBy === "RANDOM()"
      ? "order by RANDOM()"
      : selopts.orderBy &&
        typeof selopts.orderBy === "object" &&
        selopts.orderBy.distance
      ? `order by ${getDistanceOrder(selopts.orderBy.distance)}`
      : selopts.orderBy && typeof selopts.orderBy === "string" && selopts.nocase
      ? `order by lower(${quote(sqlsanitizeAllowDots(selopts.orderBy))})${
          selopts.orderDesc ? " DESC" : ""
        }`
      : selopts.orderBy && typeof selopts.orderBy === "string"
      ? `order by ${quote(sqlsanitizeAllowDots(selopts.orderBy))}${
          selopts.orderDesc ? " DESC" : ""
        }`
      : "";
  const limit = selopts.limit ? `limit ${toInt(selopts.limit)}` : "";
  const offset = selopts.offset ? `offset ${toInt(selopts.offset)}` : "";
  return [orderby, limit, offset].filter((s) => s).join(" ");
};

export type Row = { [key: string]: any };
