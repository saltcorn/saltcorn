const db = require("../db");
const reset = require("../db/reset_schema");
const { contract, is } = require("contractis");
const { sqlsanitize } = require("../db/internal");
const User = require("./user");

const getAllTenants = async () => {
  const tens = await db.select("_sc_tenants");
  return tens.map(({ subdomain }) => subdomain);
};

const createTenant = async ({ subdomain, email, password }) => {
  const saneDomain = sqlsanitize(subdomain.replace(".", "").toLowerCase());
  const id = await db.insert(
    "_sc_tenants",
    { subdomain: saneDomain, email },
    true
  );
  //create schema
  await db.query(`CREATE SCHEMA ${saneDomain};`);

  // set continuation storage
  //db.tenantNamespace.set("tenant", saneDomain);
  await db.runWithTenant(saneDomain, async () => {
    //reset schema
    await reset(true, saneDomain);

    //create user
    await User.create({ email, password, role_id: 1 });
  });
};

module.exports = {
  getAllTenants,
  createTenant
};
