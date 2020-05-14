const db = require("../db");
const reset = require("../db/reset_schema");
const { contract, is } = require("contractis");
const { sqlsanitize } = require("../db/internal");

const getAllTenants = async () => {
  const tens = await db.select("_sc_tenants");
  return tens.map(({ subdomain }) => subdomain);
};

const createTenant = async ({ subdomain, email, password }) => {
  const saneDomain = sqlsanitize(subdomain);
  //const id = await db.insert("_sc_tenants",{saneDomain})
  //create schema
  console.log("sane domain", saneDomain);
  db.tenantNamespace.set("tenant", saneDomain);
  //db.setTenant(saneDomain);
  await db.query(`CREATE SCHEMA ${saneDomain};`);
  // set cont storage
  //db.createTenantNamespace()

  //reset schema
  console.log("set tenent");

  await reset(true, saneDomain);
  //create user
  console.log("done createTenant");
};

module.exports = {
  getAllTenants,
  createTenant
};
