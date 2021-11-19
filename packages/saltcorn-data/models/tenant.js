/**
 * Tenant Management Data Layer Access
 * @category saltcorn-data
 * @module models/tenant
 * @subcategory models
 */
const db = require("../db");
const reset = require("../db/reset_schema");
const { contract, is } = require("contractis");
const { sqlsanitize } = require("@saltcorn/db-common/internal");
const { setConfig } = require("./config");
const fs = require("fs").promises;

/**
 * List all Tenants
 * @function
 * @returns {Promise<string[]>}
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
 *
 * Arguments:
 * subdomain - tenant name (subdomain)
 * newurl - base url of tenant
 * email - email of creator
 * description - description of tenant
 * @function
 * @param {string} subdomain
 * @param {string} [newurl]
 * @param {string} [email]
 * @param {string} [description]
 * @returns {Promise<void>}
 */
const createTenant = contract(
  is.fun(
    [is.str, is.maybe(is.str), is.maybe(is.str), is.maybe(is.str)],
    is.promise(is.undefined)
  ),
  // TODO how to set names for arguments
  async (subdomain, newurl, email, description) => {
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
const copy_tenant_template = async ({
  tenant_template,
  target,
  loadAndSaveNewPlugin,
}) => {
  const { create_backup, restore } = require("./backup");
  // TODO use a hygenic name for backup file
  const backupFile = await db.runWithTenant(tenant_template, create_backup);
  await db.runWithTenant(target, async () => {
    await restore(backupFile, loadAndSaveNewPlugin, true);

    await db.updateWhere("_sc_files", { user_id: null }, {});
    await db.deleteWhere("users", {});
    await db.reset_sequence("users");
    //
  });
  await fs.unlink(backupFile);
};

/**
 * Delete Tenant
 * Note! This is deleting all tenant data in database!
 * @function
 * @param {string} sub
 * @returns {Promise<void>}
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
 * @function
 * @param {string} s
 * @returns {string}
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
  copy_tenant_template,
};
