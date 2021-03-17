const maybe_as_tenant = async (ten, f) => {
  if (!ten) return await f();
  const db = require("@saltcorn/data/db");
  return await db.runWithTenant(ten, f);
};

module.exports = { maybe_as_tenant };
