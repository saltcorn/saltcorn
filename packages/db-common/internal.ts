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
  // https://stackoverflow.com/a/70273329/19839414
  // \p{Letter}/u
  const s = nm.replace(/[^\p{Letter}_0-9]*/gu, "");
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

export type DatabaseClient = {
  query: (sql: String, parameters?: any[]) => Promise<{ rows: Row[] }>;
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

export const ftsFieldsSqlExpr = (
  fields: any[],
  table?: string,
  schema?: string
) => {
  let fldsArray = fields
    .filter(
      (f: any) =>
        f.type && f.type.sql_name === "text" && (!f.calculated || f.stored)
    )
    .map((f: any) => {
      const fname = table
        ? `"${sqlsanitize(table)}"."${sqlsanitize(f.name)}"`
        : `"${sqlsanitize(f.name)}"`;

      return `coalesce(${
        f.type?.searchModifier ? f.type.searchModifier(fname) : fname
      },'')`;
    });
  fields
    .filter((f: any) => f.is_fkey && f?.attributes?.include_fts)
    .forEach((f) => {
      fldsArray.push(
        `coalesce((select "${f.attributes.summary_field}" from ${
          schema ? `"${schema}".` : ""
        }"${f.reftable_name}" rt where rt."${f.refname}"=${
          table ? `"${sqlsanitize(table)}".` : ""
        }"${f.name}"),'')`
      );
    });
  fldsArray.sort();
  let flds = fldsArray.join(" || ' ' || ");
  if (flds === "") flds = "''";
  return flds;
};

/**
 * Where FTS (Search)
 * @param {object} v
 * @param {string} i
 * @param {boolean} is_sqlite
 * @returns {string}
 */
const whereFTS = (
  v: {
    fields: any[];
    table?: string;
    searchTerm: string;
    schema?: string;
    language?: string;
    use_websearch?: boolean;
  },
  phs: PlaceHolderStack
): string => {
  const { fields, table, schema } = v;

  const prefixMatch = !v.searchTerm?.includes(" ");
  const searchTerm = prefixMatch ? `${v.searchTerm}:*` : v.searchTerm;
  let flds = ftsFieldsSqlExpr(fields, table, schema);
  if (phs.is_sqlite)
    return `${flds} LIKE '%' || ${phs.push(v.searchTerm)} || '%'`;
  else
    return `to_tsvector('${v.language || "english"}', ${flds}) @@ ${
      v.use_websearch ? "websearch_" : prefixMatch ? "" : `plain`
    }to_tsquery('${v.language || "english"}', ${phs.push(searchTerm)})`;
};

export type Value = string | number | boolean | Date | Value[];
export type JsonPathElem = string | number;
export type JsonPath = JsonPathElem | JsonPathElem[];

export type Where = {
  _fts?: { fields: any[]; table?: string; searchTerm: string; schema?: string };
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

export /**
 *
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const subSelectWhere =
  (phs: PlaceHolderStack) =>
  (
    k: string,
    v: {
      inSelect: {
        where: Where;
        field: string;
        table: string;
        tenant?: string;
        through?: string;
        through_pk?: string;
        valField?: string;
      };
    }
  ): string => {
    const tenantPrefix =
      !phs.is_sqlite && v.inSelect.tenant ? `"${v.inSelect.tenant}".` : "";
    if (v.inSelect.through && v.inSelect.valField) {
      const whereObj = prefixFieldsInWhere(v.inSelect.where, "ss2");
      const wheres = whereObj ? Object.entries(whereObj) : [];
      const where =
        whereObj && wheres.length > 0
          ? "where " + wheres.map(whereClause(phs)).join(" and ")
          : "";
      return `${quote(sqlsanitizeAllowDots(k))} in (select ss1."${
        v.inSelect.valField
      }" from ${tenantPrefix}"${v.inSelect.table}" ss1 join ${tenantPrefix}"${
        v.inSelect.through
      }" ss2 on ss2."${v.inSelect.through_pk || "id"}" = ss1."${v.inSelect.field}" ${where})`;
    } else {
      const whereObj = v.inSelect.where;
      const wheres = whereObj ? Object.entries(whereObj) : [];
      const where =
        whereObj && wheres.length > 0
          ? "where " + wheres.map(whereClause(phs)).join(" and ")
          : "";
      return `${quote(sqlsanitizeAllowDots(k))} in (select "${
        v.inSelect.field
      }" from ${tenantPrefix}"${v.inSelect.table}" ${where})`;
    }
  };

/**
 * creates an in select sql string with joins for joinLevels
 * and the where gets an alias prefix to the first table of the joinLevels
 * @param phs
 * @returns in select sql command
 */
const inSelectWithLevels =
  (phs: PlaceHolderStack) =>
  (
    k: string,
    v: {
      inSelectWithLevels: {
        where: Where;
        schema?: string;
        joinLevels: {
          table: string;
          fkey?: string;
          inboundKey?: string;
          pk_name?: string;
          ref_name?: string;
        }[];
      };
    }
  ): string => {
    let lastAlias = null;
    let inColumn = null;
    let whereObj = null;
    const selectParts = [];
    const joinLevels = v.inSelectWithLevels.joinLevels;
    const schema =
      v.inSelectWithLevels.schema && !phs.is_sqlite
        ? `${quote(sqlsanitize(v.inSelectWithLevels.schema))}.`
        : "";

    for (let i = 0; i < joinLevels.length; i++) {
      const { table, fkey, inboundKey, pk_name, ref_name } = joinLevels[i];
      const pk = pk_name || "id";
      const refname = ref_name || "id";
      const alias = quote(sqlsanitize(`${table}SubJ${i}`));
      if (i === 0) {
        selectParts.push(
          `from ${schema}${quote(sqlsanitize(`${table}`))} ${quote(
            sqlsanitize(`${alias}`)
          )}`
        );
        whereObj = prefixFieldsInWhere(v.inSelectWithLevels.where, alias);
        if (joinLevels.length === 1) inColumn = quote(`${alias}."${pk}"`);
      } else if (i < joinLevels.length - 1) {
        if (fkey) {
          selectParts.push(
            `join ${schema}${quote(
              sqlsanitize(`${table}`)
            )} ${alias} on ${quote(
              `${lastAlias}.${sqlsanitize(fkey)}`
            )} = ${alias}."${pk}"`
          );
        } else {
          selectParts.push(
            `join ${schema}${quote(
              sqlsanitize(`${table}`)
            )} ${alias} on ${quote(`${lastAlias}."${refname}"`)} = ${quote(
              `${alias}.${sqlsanitize(inboundKey!)}`
            )}`
          );
        }
      } else {
        if (fkey) {
          inColumn = quote(`${lastAlias}.${sqlsanitize(fkey)}`);
        } else {
          selectParts.push(
            `join ${schema}${quote(
              sqlsanitize(`${table}`)
            )} ${alias} on ${quote(`${lastAlias}."${refname}"`)} = ${quote(
              `${alias}.${sqlsanitize(`${inboundKey}`)}`
            )}`
          );
          inColumn = quote(`${alias}."${pk}"`);
        }
      }
      lastAlias = alias;
    }
    const wheres = whereObj ? Object.entries(whereObj) : [];
    const where =
      whereObj && wheres.length > 0
        ? "where " + wheres.map(whereClause(phs)).join(" and ")
        : "";
    const sqlPart = `${quote(sqlsanitizeAllowDots(k))} in (select ${quote(
      sqlsanitizeAllowDots(inColumn!)
    )} ${selectParts.join(" ")} ${where})`;
    return sqlPart;
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
const whereOr =
  (phs: PlaceHolderStack): ((ors: any[]) => string) =>
  (ors: any[]): string =>
    wrapParens(
      ors
        .map((vi: any) =>
          Object.entries(vi)
            .map((kv) => whereClause(phs)(kv))
            .join(" and ")
        )
        .join(" or ")
    );

const whereAnd =
  (phs: PlaceHolderStack): ((ors: any[]) => string) =>
  (ors: any[]): string =>
    wrapParens(
      ors
        .map((vi: any) =>
          Object.entries(vi)
            .map((kv) => whereClause(phs)(kv))
            .join(" and ")
        )
        .join(" and ")
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

const castDate = (doCast: boolean, is_sqlite: boolean, s: string) =>
  !doCast ? s : is_sqlite ? `date(${s})` : `${s}::date`;

const whereClause =
  (phs: PlaceHolderStack): (([k, v]: [string, any | [any, any]]) => string) =>
  ([k, v]: [string, any | [any, any]]): string =>
    k === "_fts"
      ? whereFTS(v, phs)
      : typeof (v || {}).not !== "undefined" && v.not.in
        ? `not (${quote(sqlsanitizeAllowDots(k))} = ${
            phs.is_sqlite ? "" : "ANY"
          } (${phs.push(v.not.in)}))`
        : typeof (v || {}).in !== "undefined"
          ? `${quote(sqlsanitizeAllowDots(k))} = ${
              phs.is_sqlite ? "" : "ANY"
            } (${phs.push(v.in)})`
          : k === "or" && Array.isArray(v)
            ? whereOr(phs)(v)
            : k === "and" && Array.isArray(v)
              ? whereAnd(phs)(v)
              : typeof (v || {}).slugify !== "undefined"
                ? slugifyQuery(k, v.slugify, phs)
                : k === "not" && typeof v === "object"
                  ? `not (${Object.entries(v)
                      .map((kv) => whereClause(phs)(kv))
                      .join(" and ")})`
                  : k === "_false" && v
                    ? "FALSE"
                    : k === "eq" && Array.isArray(v)
                      ? // @ts-ignore
                        equals(v, phs)
                      : v && v.or && Array.isArray(v.or)
                        ? wrapParens(
                            v.or
                              .map((vi: any) => whereClause(phs)([k, vi]))
                              .join(" or ")
                          )
                        : Array.isArray(v)
                          ? v
                              .map((vi) => whereClause(phs)([k, vi]))
                              .join(" and ")
                          : typeof (v || {}).ilike !== "undefined"
                            ? `${quote(sqlsanitizeAllowDots(k))} ${
                                phs.is_sqlite ? "LIKE" : "ILIKE"
                              } '%' || ${phs.push(v.ilike)} || '%'`
                            : v instanceof RegExp
                              ? `${quote(sqlsanitizeAllowDots(k))} ${
                                  phs.is_sqlite ? "REGEXP" : "~"
                                } ${phs.push(v.source)}`
                              : typeof (v || {}).gt !== "undefined" &&
                                  typeof (v || {}).lt !== "undefined"
                                ? `${castDate(
                                    v.day_only,
                                    phs.is_sqlite,
                                    quote(sqlsanitizeAllowDots(k))
                                  )}>${v.equal ? "=" : ""}${castDate(
                                    v.day_only,
                                    phs.is_sqlite,
                                    phs.push(v.gt)
                                  )} and ${castDate(
                                    v.day_only,
                                    phs.is_sqlite,
                                    quote(sqlsanitizeAllowDots(k))
                                  )}<${v.equal ? "=" : ""}${castDate(
                                    v.day_only,
                                    phs.is_sqlite,
                                    phs.push(v.lt)
                                  )}`
                                : typeof (v || {}).gt !== "undefined"
                                  ? `${castDate(
                                      v.day_only,
                                      phs.is_sqlite,
                                      quote(sqlsanitizeAllowDots(k))
                                    )}>${v.equal ? "=" : ""}${castDate(
                                      v.day_only,
                                      phs.is_sqlite,
                                      phs.push(v.gt)
                                    )}`
                                  : typeof (v || {}).lt !== "undefined"
                                    ? `${castDate(
                                        v.day_only,
                                        phs.is_sqlite,
                                        quote(sqlsanitizeAllowDots(k))
                                      )}<${v.equal ? "=" : ""}${castDate(
                                        v.day_only,
                                        phs.is_sqlite,
                                        phs.push(v.lt)
                                      )}`
                                    : typeof (v || {}).inSelect !== "undefined"
                                      ? subSelectWhere(phs)(k, v)
                                      : typeof (v || {}).inSelectWithLevels !==
                                          "undefined"
                                        ? inSelectWithLevels(phs)(k, v)
                                        : typeof (v || {}).json !== "undefined"
                                          ? jsonWhere(k, v.json, phs)
                                          : v === null
                                            ? `${quote(sqlsanitizeAllowDots(k))} is null`
                                            : k === "not"
                                              ? `not (${typeof v === "symbol" ? v.description : phs.push(v)})`
                                              : `${quote(sqlsanitizeAllowDots(k))}=${
                                                  typeof v === "symbol"
                                                    ? v.description
                                                    : phs.push(v)
                                                }`;

function isdef(x: any) {
  return typeof x !== "undefined";
}

function jsonWhere(
  k: string,
  v: any[] | Object,
  phs: PlaceHolderStack
): string {
  const jsonpathElemEscape = (sf: JsonPathElem): string =>
    typeof sf == "number"
      ? `[${sf}]`
      : `.${
          /[\x00-\x08\x0A-\x1F\x22\x27\x7F.[\]]/.test(String(sf))
            ? JSON.stringify(String(sf))
            : sf
        }`;
  const jsonpathPrepare = (sf: JsonPath): string =>
    (/^\$[[.]/.test(String(sf)) && !/[\n\r\v\0]/.test(String(sf))
      ? String(sf)
      : `\$${
          Array.isArray(sf)
            ? sf.map(jsonpathElemEscape).join("")
            : jsonpathElemEscape(sf)
        }`
    ).replace(/'/g, "''");
  const lhs = (f: string, sf: JsonPath, convText: boolean): string =>
    phs.is_sqlite
      ? `json_extract(${quote(sqlsanitizeAllowDots(f))}, '${jsonpathPrepare(
          sf
        )}')`
      : `${convText ? "jsonb_build_array(" : ""}jsonb_path_query_first(${quote(
          sqlsanitizeAllowDots(f)
        )}, '${jsonpathPrepare(sf)}')${convText ? ")->>0" : ""}`;

  if (Array.isArray(v)) return `${lhs(k, v[0], true)}=${phs.push(v[1])}`;
  else {
    return andArray(
      Object.entries(v).map(([kj, vj]) =>
        vj.ilike
          ? `${lhs(k, kj, true)} ${
              phs.is_sqlite ? "LIKE" : "ILIKE"
            } '%' || ${phs.push(vj.ilike as Value)} || '%'`
          : isdef(vj.gte) || isdef(vj.lte)
            ? andArray(
                [
                  isdef(vj.gte)
                    ? `${lhs(k, kj, false)} >= ${phs.push(vj.gte as Value)}`
                    : "",
                  isdef(vj.lte)
                    ? `${lhs(k, kj, false)} <= ${phs.push(vj.lte as Value)}`
                    : "",
                ].filter((s) => s)
              )
            : `${lhs(k, kj, true)}=${phs.push(vj as Value)}`
      )
    );
  }
}

function andArray(ss: string[]): string {
  if (ss.length === 1) return ss[0];
  else return ss.join(" and ");
}

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
  is_sqlite: boolean = false,
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
  latField: number | string;
  longField: number | string;
  lat: number | string;
  long: number | string;
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
    `${latField}`
  )} - ${+lat})*(${sqlsanitizeAllowDots(
    `${latField}`
  )} - ${+lat})) + ((${sqlsanitizeAllowDots(
    `${longField}`
  )} - ${+long})*(${sqlsanitizeAllowDots(
    `${longField}`
  )} - ${+long})*${cos_lat_2})`;
};

export type Operator =
  | "target"
  | "field"
  | { type: string; name: string; args: Operator[] };

const getOperatorOrder = (
  {
    operator,
    target,
    field,
  }: {
    operator: Operator;
    target: string;
    field: string;
  },
  values: any[],
  isSQLite: boolean
) => {
  const validOp = (s: string) => {
    if (s.includes("--")) return "";
    if (s.includes(";")) return "";
    if (s.includes("/*")) return "";
    if (s.includes("*/")) return "";
    if (s.includes("'")) return "";
    if (s.includes('"')) return "";
    if (s.includes("(")) return "";
    if (s.includes(")")) return "";
    if (s.includes(" ")) return "";
    return s;
  };
  const ppOp = (ast: any): string => {
    if (ast === "target") {
      values.push(target);
      return isSQLite ? "?" : `$${values.length}`;
    }
    if (ast === "field") return sqlsanitize(field);
    const { type, name, args } = ast;
    switch (type) {
      case "SqlFun":
        return `${sqlsanitize(name)}(${args.map(ppOp).join(",")})`;
      case "SqlBinOp":
        const [arg1, arg2] = args;
        return `${ppOp(arg1)}${validOp(name)}${ppOp(arg2)}`;
    }
    return "";
  };
  return ppOp(operator);
};

export type SelectOptions = {
  orderBy?:
    | { distance: CoordOpts }
    | { operator: Operator | string; target: string; field: string }
    | string;
  limit?: string | number;
  offset?: string | number;
  nocase?: boolean;
  orderDesc?: boolean;
  cached?: boolean;
  ignore_errors?: boolean;
  versioned?: boolean; //TODO rm this and below
  min_role_read?: number;
  min_role_write?: number;
  ownership_field_id?: number;
  ownership_formula?: string;
  provider_name?: string;
  provider_cfg?: any;
  fields?: [string];
  has_sync_info?: boolean;
  description?: string;
  recursive?: boolean; // for File.find()
  client?: DatabaseClient;
};
export const orderByIsObject = (
  object: any
): object is { distance: CoordOpts } => {
  return object && object.distance;
};

export const orderByIsOperator = (
  object: any
): object is { operator: Operator; target: string; field: string } => {
  return object && object.operator && typeof object.operator !== "string";
};

export type JoinField = {
  ref: any;
  target: any;
  through?: any;
  rename_object?: any;
  ontable?: any;
};

export type JoinFields = {
  [key: string]: JoinField;
};

export type JoinOptions = {
  joinFields?: JoinFields;
  aggregations?: { [nm: string]: AggregationOptions };
  where: any;
  starFields?: boolean;
} & SelectOptions;

export type AggregationOptions = {
  table: string;
  ref?: string;
  field?: string;
  valueFormula?: string;
  where?: Where;
  aggregate: string;
  subselect?: SubselectOptions;
  through?: string;
  orderBy?: string;
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
export const mkSelectOptions = (
  selopts: SelectOptions,
  values: any[],
  isSQLite: boolean
): string => {
  const orderby =
    selopts.orderBy === "RANDOM()"
      ? "order by RANDOM()"
      : selopts.orderBy &&
          typeof selopts.orderBy === "object" &&
          "distance" in selopts.orderBy
        ? `order by ${getDistanceOrder(selopts.orderBy.distance)}`
        : selopts.orderBy &&
            typeof selopts.orderBy === "string" &&
            selopts.nocase
          ? `order by lower(${quote(sqlsanitizeAllowDots(selopts.orderBy))})${
              selopts.orderDesc ? " DESC" : ""
            }`
          : selopts.orderBy && typeof selopts.orderBy === "string"
            ? `order by ${quote(sqlsanitizeAllowDots(selopts.orderBy))}${
                selopts.orderDesc ? " DESC" : ""
              }`
            : selopts.orderBy &&
                typeof selopts.orderBy === "object" &&
                "operator" in selopts.orderBy &&
                typeof selopts.orderBy.operator === "object"
              ? `order by ${getOperatorOrder(selopts.orderBy as any, values, isSQLite)}`
              : "";
  const limit = selopts.limit ? `limit ${toInt(selopts.limit)}` : "";
  const offset = selopts.offset ? `offset ${toInt(selopts.offset)}` : "";
  return [orderby, limit, offset].filter((s) => s).join(" ");
};

export type Row = { [key: string]: any };
export type PrimaryKeyValue = number | string;

export const prefixFieldsInWhere = (inputWhere: any, tablePrefix: string) => {
  if (!inputWhere) return {};
  const whereObj: Where = {};
  Object.keys(inputWhere).forEach((k) => {
    if (k === "_fts") whereObj[k] = { table: tablePrefix, ...inputWhere[k] };
    else if (k === "not") {
      whereObj.not = prefixFieldsInWhere(inputWhere[k], tablePrefix);
    } else if (k === "or") {
      whereObj.or = Array.isArray(inputWhere[k])
        ? inputWhere[k].map((w: Where) => prefixFieldsInWhere(w, tablePrefix))
        : [prefixFieldsInWhere(inputWhere[k], tablePrefix)];
    } else if (k === "and") {
      whereObj.and = Array.isArray(inputWhere[k])
        ? inputWhere[k].map((w: Where) => prefixFieldsInWhere(w, tablePrefix))
        : prefixFieldsInWhere(inputWhere[k], tablePrefix);
    } else if (k === "eq") {
      whereObj[k] = inputWhere[k]; // TODO check for fieldnames
    } else whereObj[`${tablePrefix}."${k}"`] = inputWhere[k];
  });
  return whereObj;
};

export const sqlFun = (name: string, ...args: any[]) => ({
  type: "SqlFun",
  name,
  args,
});
export const sqlBinOp = (name: string, ...args: any[]) => ({
  type: "SqlBinOp",
  name,
  args,
});
