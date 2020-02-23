const types = require("../types");

//https://stackoverflow.com/questions/15300704/regex-with-my-jquery-function-for-sql-variable-name-validation
const sqlsanitize = nm => nm.replace(/\b@[a-zA-Z][a-zA-Z0-9]*\b/g, "");

const fkeyPrefix = "Key to ";

const dbFieldsToFormFields = (fields) => {
  const f2f = f => (
    f.ftype.startsWith(fkeyPrefix) 
    ? {
        label: f.flabel,
      name: f.fname,      
      input_type: "number"
    }
    : {
      label: f.flabel,
      name: f.fname,
      type: types.as_dict[f.ftype],
      input_type: "fromtype"
    })

  return fields.map(f2f);
}

const calc_sql_type = ftype => {
    if (ftype.startsWith(fkeyPrefix)) {
      return `int references ${sqlsanitize(ftype.replace(fkeyPrefix, ""))} (id)`;
    } else {
      return types.as_dict[v.ftype].sql_name;
    }
  };

module.exports = {
  sqlsanitize,
  fkeyPrefix,
  dbFieldsToFormFields,
  calc_sql_type
};
