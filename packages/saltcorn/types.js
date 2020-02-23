const string = {
  name: "String",
  sql_name: "text",
  attributes: [
    { name: "match", type: "String", required: false },
    //{ name: "options", type: "String[]", required: false }
  ],
  editAs: (nm, v) =>
    `<input type="text" class="form-control" name="${nm}" id="input${nm}" ${
      v ? `value="${v}"` : ""
    }>`
};

const int = {
  name: "Integer",
  sql_name: "text",
  editAs: (nm, v) =>
    `<input type="number" class="form-control" name="${nm}" id="input${nm}" ${
      v ? `value="${v}"` : ""
    }>`,
  attributes: [
    { name: "max", type: "Integer", required: false },
    { name: "min", type: "Integer", required: false }
  ]
};

const types = [string, int];

const mkTyDict = tys => {
  var d = {};
  tys.forEach(t => {
    d[t.name] = t;
  });
  return d;
};

types.as_dict = mkTyDict(types);

types.names = types.map(t => t.name);

module.exports = types;
