//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
const sqlsanitize = nm => nm.replace(/[^A-Za-z_0-9.]*/g, "");

const whereFTS = (v, i) => {
  const { fields } = v;
  const flds = fields
    .filter(f.type && f.type.sql_name === "text")
    .map(f => sqlsanitize(f.name))
    .join(" || ' ' || ");
  //to_tsvector('english', body) @@ to_tsquery('english', 'friend')
  return `to_tsvector('english', ${flds}) @@ to_tsquery('english', $${i + 1})`;
};

const whereClause = ([k, v], i) =>
  k === "_fts"
    ? whereFTS(v, i)
    : typeof (v || {}).in !== "undefined"
    ? `${sqlsanitize(k)} = ANY ($${i + 1})`
    : typeof (v || {}).ilike !== "undefined"
    ? `${sqlsanitize(k)} ILIKE '%' || $${i + 1} || '%'`
    : `${sqlsanitize(k)}=$${i + 1}`;

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
  const orderby = selopts.orderBy
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
  mkSelectOptions
};
