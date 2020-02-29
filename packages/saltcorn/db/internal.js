//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
const sqlsanitize = nm => nm.replace(/\W/g, "");

const mkWhere = whereObj => {
  const wheres = whereObj ? Object.entries(whereObj) : [];
  const where =
    whereObj && wheres.length > 0
      ? "where " +
        wheres.map((kv, i) => `${sqlsanitize(kv[0])}=$${i + 1}`).join(" and ")
      : "";
  const values = wheres.map(kv => kv[1]);
  return { where, values };
};

module.exports = {
  sqlsanitize,
  mkWhere
};
