const types = require("../types");
const { sqlsanitize } = require("../db/internal.js");

const fkeyPrefix = "Key to ";

const calc_sql_type = ftype => {
  if (ftype.startsWith(fkeyPrefix)) {
    return `int references ${sqlsanitize(ftype.replace(fkeyPrefix, ""))} (id)`;
  } else {
    return types.as_dict[ftype].sql_name;
  }
};

const attributesToFormFields = type => {
  const a2ff = attr => ({
    label: attr.name,
    name: attr.name,
    input_type: "fromtype",
    type: types.as_dict[attr.type]
  });
  return type.attributes ? type.attributes.map(a2ff) : [];
};

module.exports = {
  sqlsanitize,
  fkeyPrefix,
  calc_sql_type,
  attributesToFormFields
};
