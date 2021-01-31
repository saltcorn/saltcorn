const v8 = require("v8");

const removeEmptyStrings = (obj) => {
  var o = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== "" && v !== null) o[k] = v;
  });
  return o;
};
const removeDefaultColor = (obj) => {
  var o = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== "#000000") o[k] = v;
  });
  return o;
};
const isEmpty = (o) => Object.keys(o).length === 0;

const asyncMap = async (xs, asyncF) => {
  var res = [];
  var ix = 0;
  for (const x of xs) {
    res.push(await asyncF(x, ix));
    ix += 1;
  }
  return res;
};

const numberToBool = (b) => (typeof b === "number" ? b > 0 : b);

const stringToJSON = (v) => {
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch (e) {
    throw new Error(`stringToJSON(${JSON.stringify(v)}): ${e.message}`);
  }
};
const apply = (f, x) => (typeof f === "function" ? f(x) : f);

const applyAsync = async (f, x) => {
  if (typeof f === "function") return await f(x);
  else return f;
};

const structuredClone = (obj) => {
  return v8.deserialize(v8.serialize(obj));
};
module.exports = {
  removeEmptyStrings,
  removeDefaultColor,
  isEmpty,
  asyncMap,
  numberToBool,
  stringToJSON,
  applyAsync,
  apply,
  structuredClone,
};
