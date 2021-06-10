/**
 * Tenant Management Data Layer Access
 *
 */
const db = require("../db");
const reset = require("../db/reset_schema");
const { contract, is } = require("contractis");
const { sqlsanitize } = require("../db/internal");
const { setConfig } = require("./config");
/**
 * List all Tenants
 * @type {*|(function(...[*]=): *)}
 */
const getAllTenants = contract(
  is.fun([], is.promise(is.array(is.str))),
  async () => {
    const tens = await db.select("_sc_tenants");
    return tens.map(({ subdomain }) => subdomain);
  }
);
/**
 * Create Tenant and switch to It:
 * - normalize domain name
 * - create db schema
 * - reset db schema (create required )
 * - change current base_url
 * @type {*|(function(...[*]=): *)}
 *
 * Arguments:
 * subdomain - tenant name (subdomain)
 * newurl - base url of tenant
 * email - email of creator
 * description - description of tenant
 */
const createTenant = contract(
  is.fun([is.str, is.maybe(is.str), is.maybe(is.str), is.maybe(is.str)], is.promise(is.undefined)),
  // TODO how to set names for arguments
  async ( subdomain, newurl, email, description) => {
      // normalize domain name
    const saneDomain = domain_sanitize(subdomain);

    // add email
    const saneEmail = typeof email !== "undefined" ? email : "";
    // add description
    const saneDescription = description !== "undefined" ? description : null;
    // add info about tenant into main site
    const id = await db.insert(
      "_sc_tenants",
      { subdomain: saneDomain, email: saneEmail, description: saneDescription },
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
/**
 * Delete Tenant
 * Note! This is deleting all tenant data in database!
 * @type {*|(function(...[*]=): *)}
 */
const deleteTenant = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (sub) => {
    const subdomain = domain_sanitize(sub);
    // drop tenant db schema
    await db.query(`drop schema if exists "${subdomain}" CASCADE `);
    // delete information about tenant from main site
    await db.deleteWhere("_sc_tenants", { subdomain });
  }
);
/**
 * Sanitize Domain (Normalize domain name).
 * - force to lower case
 * - remove . in name
 * @type {*|(function(...[*]=): *)}
 */
const domain_sanitize = contract(is.fun(is.str, is.str), (s) =>
  sqlsanitize(s.replace(".", "").toLowerCase())
);
/**
 * Call fuction f for each Tenant
 * @param f - called function
 * @returns {Promise<void>} no result
 */
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
