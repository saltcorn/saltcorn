//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
const sqlsanitize = nm => nm.replace(/\b@[a-zA-Z][a-z_A-Z0-9]*\b/g, "");

module.exports = {
  sqlsanitize
};
