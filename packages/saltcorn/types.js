const string = {
  name: "String",
  sql_name: "text",
  attributes: [{ name: "options", type: "String[]", required: false }]
};

const int = {
  name: "Integer",
  sql_name: "text",

  attributes: [
    { name: "max", type: "Integer", required: false },
    { name: "min", type: "Integer", required: false }
  ]
};

const types = [string, int];

const type_options = types.map(t => t.name);

module.exports = {
  types,
  type_options
};
