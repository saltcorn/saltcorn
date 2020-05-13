const db = require("../db");
const reset = require("../db/reset_schema");
const { contract, is } = require("contractis");
const { sqlsantize } = require("../db/internal")

const getAllTenants = async () => {
  const tens = await db.select("_sc_tenants");
  return tens.map(({subdomain})=>subdomain);
};

const createTenant = async({subdomain, email, password})=>{
    const id = await db.insert("_sc_tenants",{subdomain})
    //create schema
    await db.query(`CREATE SCHEMA ${sqlsantize(schema)};`)
    //reset schema
    await reset(true, sqlsantize(subdomain))
    //create user
}

module.exports = {
    getAllTenants,
    createTenant
};
