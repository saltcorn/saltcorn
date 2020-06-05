const { contract, is } = require("contractis");

//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
const sqlsanitize = contract(is.fun(is.str, is.str), nm => {
  const s = nm.replace(/[^A-Za-z_0-9]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
});
const sqlsanitizeAllowDots = contract(is.fun(is.str, is.str), nm => {
  const s = nm.replace(/[^A-Za-z_0-9.]*/g, "");
  if (s[0] >= "0" && s[0] <= "9") return `_${s}`;
  else return s;
});

const whereFTS = (v, i) => {
  const { fields, table } = v;
  var flds = fields
    .filter(f => f.type && f.type.sql_name === "text")
    .map(f =>
      table
        ? `${sqlsanitize(table)}.${sqlsanitize(f.name)}`
        : sqlsanitize(f.name)
    )
    .join(" || ' ' || ");
  if(flds==='') flds="''"
  return `to_tsvector('english', ${flds}) @@ plainto_tsquery('english', $${i +
    1})`;
};

const whereClause = ([k, v], i) =>
  k === "_fts"
    ? whereFTS(v, i)
    : typeof (v || {}).in !== "undefined"
    ? `${sqlsanitizeAllowDots(k)} = ANY ($${i + 1})`
    : typeof (v || {}).ilike !== "undefined"
    ? `${sqlsanitizeAllowDots(k)} ILIKE '%' || $${i + 1} || '%'`
    : `${sqlsanitizeAllowDots(k)}=$${i + 1}`;

const getVal = ([k, v]) =>
  k === "_fts"
    ? v.searchTerm
    : typeof (v || {}).in !== "undefined"
    ? v.in
    : typeof (v || {}).ilike !== "undefined"
    ? v.ilike
    : v;

const mkWhere = whereObj => {
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const where =
    whereObj && wheres.length > 0
      ? "where " + wheres.map(whereClause).join(" and ")
      : "";
  const values = wheres.map(getVal);
  return { where, values };
};

const toInt = x =>
  typeof x === "number"
    ? Math.round(x)
    : typeof x === "string"
    ? parseInt(x)
    : null;

const mkSelectOptions = selopts => {
  const orderby =
    selopts.orderBy === "RANDOM()"
      ? "order by RANDOM()"
      : selopts.orderBy
      ? `order by ${sqlsanitize(selopts.orderBy)}${
          selopts.orderDesc ? " DESC" : ""
        }`
      : "";
  const limit = selopts.limit ? `limit ${toInt(selopts.limit)}` : "";
  const offset = selopts.offset ? `offset ${toInt(selopts.offset)}` : "";
  return [orderby, limit, offset].filter(s => s).join(" ");
};

module.exports = {
  sqlsanitize,
  mkWhere,
  mkSelectOptions,
  sqlsanitizeAllowDots
};
