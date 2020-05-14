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
  await db.query(`CREATE SCHEMA ${saneDomain};`);
  //create schema
  db.tenantNamespace.set("tenant", saneDomain);
  // set cont storage

  //reset schema
  await reset(true, saneDomain);
  //create user


};

module.exports = {
  getAllTenants,
  createTenant
};
