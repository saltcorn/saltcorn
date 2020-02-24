const string = {
  name: "String",
  sql_name: "text",
  attributes: [
    { name: "match", type: "String", required: false }
    //{ name: "options", type: "String[]", required: false }
  ],
  editAs: (nm, v) =>
    `<input type="text" class="form-control" name="${nm}" id="input${nm}" ${
      v ? `value="${v}"` : ""
    }>`,
  read: v => {
    switch (typeof v) {
      case "string":
        return v;
      default:
        return undefined;
    }
  },
  validate: ({match}) => x => true

};
const isdef = x=>
  typeof x ==="undefined" ? false : true
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
  ],
  read: v => {
    switch (typeof v) {
      case "number":
        return v;
      case "string":
        const parsed =  parseInt(v)
        return isNaN(parsed) ? undefined : parsed;
      default:
        return undefined;
    }
  },
  validate: ({min, max}) => x => {
    if(isdef(min) && x < min)
      return {error: `Must be ${min} or higher`}
    if(isdef(max) && x > max)
      return {error: `Must be ${max} or less`}
    return true
  }
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
