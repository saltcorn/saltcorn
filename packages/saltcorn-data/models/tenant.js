const db = require("../db");
const reset = require("../db/reset_schema");
const { contract, is } = require("contractis");
const { sqlsanitize } = require("../db/internal");
const { setConfig } = require("./config");
const getAllTenants = contract(
  is.fun([], is.promise(is.array(is.str))),
  async () => {
    const tens = await db.select("_sc_tenants");
    return tens.map(({ subdomain }) => subdomain);
  }
);

const createTenant = contract(
  is.fun([is.str, is.maybe(is.str)], is.promise(is.undefined)),
  async (subdomain, newurl) => {
    const saneDomain = domain_sanitize(subdomain);
    const id = await db.insert(
      "_sc_tenants",
      { subdomain: saneDomain, email: "" },
      { noid: true }
    );
    //create schema
    await db.query(`CREATE SCHEMA "${saneDomain}";`);

    // set continuation storage
    //db.tenantNamespace.set("tenant", saneDomain);
    await db.runWithTenant(saneDomain, async () => {
      //reset schema
      await reset(true, saneDomain);
      if (newurl) await setConfig("base_url", newurl);
    });
  }
);

const deleteTenant = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (sub) => {
    const subdomain = domain_sanitize(sub);
    await db.query(`drop schema if exists "${subdomain}" CASCADE `);
    await db.deleteWhere("_sc_tenants", { subdomain });
  }
);

const domain_sanitize = contract(is.fun(is.str, is.str), (s) =>
  sqlsanitize(s.replace(".", "").toLowerCase())
);

const eachTenant = async (f) => {
  await f();
  if (db.is_it_multi_tenant()) {
    const tenantList = await getAllTenants();
    for (const domain of tenantList) await db.runWithTenant(domain, f);
  }
};

module.exports = {
  getAllTenants,
  createTenant,
  domain_sanitize,
  deleteTenant,
  eachTenant,
};
