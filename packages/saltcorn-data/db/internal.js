const { contract, is } = require("contractis");
const { is_sqlite } = require("./connect");

//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
const sqlsanitize = contract(is.fun(is.str, is.str), (nm) => {
  const s = nm.replace(/[^A-Za-z_0-9]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
});
const sqlsanitizeAllowDots = contract(is.fun(is.str, is.str), (nm) => {
  const s = nm.replace(/[^A-Za-z_0-9."]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
});

const whereFTS = (v, i, is_sqlite) => {
  const { fields, table } = v;
  var flds = fields
    .filter((f) => f.type && f.type.sql_name === "text")
    .map((f) =>
      table
        ? `"${sqlsanitize(table)}"."${sqlsanitize(f.name)}"`
        : `"${sqlsanitize(f.name)}"`
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

const whereClause = (is_sqlite, i) => ([k, v]) =>
  k === "_fts"
    ? whereFTS(v, i(), is_sqlite)
    : typeof (v || {}).in !== "undefined"
    ? `${sqlsanitizeAllowDots(k)} = ${is_sqlite ? "" : "ANY"} (${placeHolder(
        is_sqlite,
        i()
      )})`
    : typeof (v || {}).ilike !== "undefined"
    ? `${sqlsanitizeAllowDots(k)} ${
        is_sqlite ? "LIKE" : "ILIKE"
      } '%' || ${placeHolder(is_sqlite, i())} || '%'`
    : typeof (v || {}).gt !== "undefined"
    ? `${sqlsanitizeAllowDots(k)}>${v.equal ? "=" : ""}${placeHolder(
        is_sqlite,
        i()
      )}`
    : typeof (v || {}).lt !== "undefined"
    ? `${sqlsanitizeAllowDots(k)}<${v.equal ? "=" : ""}${placeHolder(
        is_sqlite,
        i()
      )}`
    : v === null
    ? `${sqlsanitizeAllowDots(k)} is null`
    : `${sqlsanitizeAllowDots(k)}=${placeHolder(is_sqlite, i())}`;

const getVal = ([k, v]) =>
  k === "_fts"
    ? v.searchTerm
    : typeof (v || {}).in !== "undefined"
    ? v.in
    : typeof (v || {}).ilike !== "undefined"
    ? v.ilike
    : typeof (v || {}).lt !== "undefined"
    ? v.lt
    : typeof (v || {}).gt !== "undefined"
    ? v.gt
    : v;

const mkWhere = (whereObj, is_sqlite) => {
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const where =
    whereObj && wheres.length > 0
      ? "where " + wheres.map(whereClause(is_sqlite, mkCounter())).join(" and ")
      : "";
  const values = wheres.map(getVal).filter((v) => v !== null);
  return { where, values };
};

const toInt = (x) =>
  typeof x === "number"
    ? Math.round(x)
    : typeof x === "string"
    ? parseInt(x)
    : null;

const mkSelectOptions = (selopts) => {
  const orderby =
    selopts.orderBy === "RANDOM()"
      ? "order by RANDOM()"
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
