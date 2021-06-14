const { footer } = require("@saltcorn/markup/tags");
const { contract, is } = require("contractis");
const { is_sqlite } = require("./connect");

//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
/**
 * Transform value to correct sql name.
 * Note! Dont use other symbols than ^A-Za-z_0-9
 * @type {*|(function(...[*]=): *)}
 */
const sqlsanitize = contract(is.fun(is.str, is.str), (nm) => {
  const s = nm.replace(/[^A-Za-z_0-9]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
});
/**
 * Transform value to correct sql name.
 * Instead of sqlsanitize also allows .
 * For e.g. table name
 * Note! Dont use other symbols than ^A-Za-z_0-9.
 * @type {*|(function(...[*]=): *)}
 */
const sqlsanitizeAllowDots = contract(is.fun(is.str, is.str), (nm) => {
  const s = nm.replace(/[^A-Za-z_0-9."]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
});
/**
 *
 * @param v
 * @param i
 * @param is_sqlite
 * @returns {`to_tsvector('english', ${*}) @@ plainto_tsquery('english', $${string})`|`${*} LIKE '%' || ? || '%'`}
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

const placeHolder = (is_sqlite, i) => (is_sqlite ? `?` : `$${i}`);

const mkCounter = () => {
  let i = 0;
  return () => {
    i += 1;
    return i;
  };
};
const subSelectWhere = (is_sqlite, i) => (k, v) => {
  const whereObj = v.inSelect.where;
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const where =
    whereObj && wheres.length > 0
      ? "where " + wheres.map(whereClause(is_sqlite, i)).join(" and ")
      : "";
  return `${quote(sqlsanitizeAllowDots(k))} in (select ${v.inSelect.field} from ${
    v.inSelect.table
  } ${where})`;
};
const subSelectVals = (v) => {
  const whereObj = v.inSelect.where;
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const xs = wheres
    .map(getVal)
    .flat(1)
    .filter((v) => v !== null);
  return xs;
};
const quote = (s) => (s.includes(".") || s.includes('"') ? s : `"${s}"`);

const whereClause = (is_sqlite, i) => ([k, v]) =>
  k === "_fts"
    ? whereFTS(v, i(), is_sqlite)
    : typeof (v || {}).in !== "undefined"
    ? `${quote(sqlsanitizeAllowDots(k))} = ${
        is_sqlite ? "" : "ANY"
      } (${placeHolder(is_sqlite, i())})`
    : v && v.or && Array.isArray(v.or)
    ? v.or.map((vi) => whereClause(is_sqlite, i)([k, vi])).join(" or ")
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
    : `${quote(sqlsanitizeAllowDots(k))}=${placeHolder(is_sqlite, i())}`;

const getVal = ([k, v]) =>
  k === "_fts"
    ? v.searchTerm
    : typeof (v || {}).in !== "undefined"
    ? [v.in]
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
    : v;

const mkWhere = (whereObj, is_sqlite) => {
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const where =
    whereObj && wheres.length > 0
      ? "where " + wheres.map(whereClause(is_sqlite, mkCounter())).join(" and ")
      : "";
  const values = wheres
    .map(getVal)
    .flat(1)
    .filter((v) => v !== null);
  return { where, values };
};

const toInt = (x) =>
  typeof x === "number"
    ? Math.round(x)
    : typeof x === "string"
    ? parseInt(x)
    : null;

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
