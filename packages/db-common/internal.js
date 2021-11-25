/**
 * @category db-common
 * @module internal
 */
const { footer } = require("@saltcorn/markup/tags");
const { contract, is } = require("contractis");

//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
/**
 * Transform value to correct sql name.
 * Note! Dont use other symbols than ^A-Za-z_0-9
 * @function
 * @param {string} nm
 * @returns {string}
 */
const sqlsanitize = contract(is.fun(is.or(is.str, is.any), is.str), (nm) => {
  if (typeof nm === "symbol") return sqlsanitize(nm.description);

  const s = nm.replace(/[^A-Za-z_0-9]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
});
/**
 * Transform value to correct sql name.
 * Instead of sqlsanitize also allows .
 * For e.g. table name
 * Note! Dont use other symbols than ^A-Za-z_0-9.
 * @function
 * @param {string} nm
 * @returns {string}
 */
const sqlsanitizeAllowDots = contract(
  is.fun(is.or(is.str, is.any), is.str),
  (nm) => {
    if (typeof nm === "symbol") return sqlsanitizeAllowDots(s.description);
    const s = nm.replace(/[^A-Za-z_0-9."]*/g, "");
    if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
    else return s;
  }
);
/**
 *
 * @param {object} v
 * @param {string} i
 * @param {boolean} is_sqlite
 * @returns {string}
 */
const whereFTS = (v, i, is_sqlite) => {
  const { fields, table } = v;
  var flds = fields
    .filter((f) => f.type && f.type.sql_name === "text")
    .map(
      (f) =>
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
const placeHolder = (is_sqlite, i) => (is_sqlite ? `?` : `$${i}`);

/**
 * @returns {number}
 */
const mkCounter = (init = 0) => {
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
const subSelectWhere = (is_sqlite, i) => (k, v) => {
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
const subSelectVals = (v) => {
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
const wrapParens = (s) => (s ? `(${s})` : s);
/**
 * @param {string} s
 * @returns {string}
 */
const quote = (s) => (s.includes(".") || s.includes('"') ? s : `"${s}"`);
/**
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const whereOr = (is_sqlite, i) => (ors) =>
  wrapParens(
    ors
      .map((vi) =>
        Object.entries(vi)
          .map((kv) => whereClause(is_sqlite, i)(kv))
          .join(" and ")
      )
      .join(" or ")
  );
const equals = ([v1, v2], is_sqlite, i) => {
  const pVal = (v) =>
    typeof v === "symbol"
      ? quote(sqlsanitizeAllowDots(v.description))
      : placeHolder(is_sqlite, i());
  const isNull = (v) => `${pVal(v)} is null`;
  if (v1 === null) return isNull(v2);
  if (v2 === null) return isNull(v1);
  return `${pVal(v1)}=${pVal(v2)}`;
};
const equalsVals = (vs) => {
  let vals = [];

  vs.forEach((v) => {
    if (v !== null && typeof v !== "symbol") vals.push(v);
  });
  return vals;
};
/**
 * @param {boolean} is_sqlite
 * @param {string} i
 * @returns {function}
 */
const whereClause = (is_sqlite, i) => ([k, v]) =>
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
    ? equals(v, is_sqlite, i)
    : v && v.or && Array.isArray(v.or)
    ? wrapParens(
        v.or.map((vi) => whereClause(is_sqlite, i)([k, vi])).join(" or ")
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
const getVal = ([k, v]) =>
  k === "_fts"
    ? v.searchTerm
    : typeof (v || {}).in !== "undefined"
    ? [v.in]
    : k === "not" && typeof v === "object"
    ? Object.entries(v).map(getVal).flat(1)
    : k === "eq" && Array.isArray(v)
    ? equalsVals(v)
    : k === "or" && Array.isArray(v)
    ? v.map((vi) => Object.entries(vi).map(getVal)).flat(1)
    : v && v.or && Array.isArray(v.or)
    ? v.or.map((vi) => getVal([k, vi])).flat(1)
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

/**
 * @param {object} whereObj
 * @param {boolean} is_sqlite
 * @param {number} initCount
 * @returns {object}
 */
const mkWhere = (whereObj, is_sqlite, initCount = 0) => {
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
const toInt = (x) =>
  typeof x === "number"
    ? Math.round(x)
    : typeof x === "string"
    ? parseInt(x)
    : null;

/**
 * @param {object} opts
 * @param {string} opts.latField
 * @param {string} opts.longField
 * @param {number} opts.lat
 * @param {number} opts.long
 * @returns {string}
 */
const getDistanceOrder = ({ latField, longField, lat, long }) => {
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
const mkSelectOptions = (selopts) => {
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

module.exports = {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
  sqlsanitizeAllowDots,
};
