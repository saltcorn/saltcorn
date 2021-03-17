const maybe_as_tenant = async (ten, f) => {
  if (!ten) return await f();
  const db = require("@saltcorn/data/db");
  return await db.runWithTenant(ten, f);
};

const parseJSONorString = (s) => {
  try {
    return JSON.parse(s);
  } catch (e) {
    return s;
  }
};
module.exports = { maybe_as_tenant, parseJSONorString };
