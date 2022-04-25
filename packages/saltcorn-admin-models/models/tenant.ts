/**
 * Tenant Management Data Layer Access
 * @category saltcorn-admin-models
 * @module tenant
 */
import db from "@saltcorn/data/db/index";
const reset = require("@saltcorn/data/db/reset_schema");
import { sqlsanitize } from "@saltcorn/db-common/internal";
import config from "@saltcorn/data/models/config";
const { setConfig } = config;
import { unlink } from "fs/promises";
import Plugin from "@saltcorn/data/models/plugin";
import type { Row } from "@saltcorn/db-common/internal";
import backup from "./backup";
const { create_backup, restore } = backup;
const { tenants, process_send } = require("@saltcorn/data/db/state");

/**
 * List all Tenants
 * @function
 * @returns {Promise<string[]>}
 */
const getAllTenants = async (): Promise<string[]> => {
  const tens = await db.select("_sc_tenants");
  return tens.map(({ subdomain }: { subdomain: string }) => subdomain);
};

/**
 * List all Tenants
 * @function
 * @returns {Promise<string[]>}
 */
const getAllTenantRows = async (): Promise<Row[]> => {
  return await db.select("_sc_tenants");
};
/**
 * Insert Tenant
 * - normalize domain name
 * - create db schema
 * - reset db schema (create required )
 * @function
 * @param {string} subdomain tenant name (subdomain)
 * @param {string} [email] email of creator
 * @param {string} [description] description of tenant
 * @returns {Promise<void>}
 */
const insertTenant =
  // TODO how to set names for arguments
  async (
    subdomain: string,
    email?: string,
    description?: string
  ): Promise<string> => {
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
    if (!db.isSQLite) await db.query(`CREATE SCHEMA "${saneDomain}";`);
    return saneDomain;
  };
/**
 * Switch to Tenant:
 * - change current base_url
 * @param subdomain tenant name (subdomain)
 * @param newurl base url of tenant
 */
const switchToTenant = async (
  domain: string,
  newurl: string
): Promise<void> => {
  // set continuation storage
  //db.tenantNamespace.set("tenant", saneDomain);
  await db.runWithTenant(domain, async () => {
    //reset schema
    await reset(true, domain);
    if (newurl) await setConfig("base_url", newurl);
  });
};
const copy_tenant_template = async ({
  tenant_template,
  target,
  state,
  loadAndSaveNewPlugin,
}: {
  tenant_template: string;
  target: string;
  state: any;
  loadAndSaveNewPlugin: (plugin: Plugin) => void;
}) => {
  // TODO use a hygenic name for backup file
  const backupFile = await db.runWithTenant(tenant_template, create_backup);
  await db.runWithTenant(target, async () => {
    await restore(backupFile, loadAndSaveNewPlugin, true);

    await db.updateWhere("_sc_files", { user_id: null }, {});
    await db.deleteWhere("users", {});
    await db.reset_sequence("users");
    //
  });
  await unlink(backupFile);
};

/**
 * Delete Tenant
 * Note! This is deleting all tenant data in database!
 * @function
 * @param {string} sub
 * @returns {Promise<void>}
 */
const deleteTenant = async (sub: string): Promise<void> => {
  const subdomain = domain_sanitize(sub);
  // drop tenant db schema
  await db.query(`drop schema if exists "${subdomain}" CASCADE `);
  // delete information about tenant from main site
  await db.deleteWhere("_sc_tenants", { subdomain });
};
/**
 * Sanitize Domain (Normalize domain name).
 * - force to lower case
 * - remove . in name
 * @function
 * @param {string} s
 * @returns {string}
 */
const domain_sanitize = (s: string): string =>
  sqlsanitize(s.replace(".", "").toLowerCase());

/**
 * Call fuction f for each Tenant
 * @param f - called function
 * @returns {Promise<void>} no result
 */
const eachTenant = async (f: () => Promise<any>): Promise<void> => {
  await f();
  if (db.is_it_multi_tenant()) {
    const tenantList = await getAllTenants();
    for (const domain of tenantList) await db.runWithTenant(domain, f);
  }
};

/**
 * Create tenant
 * @param {string} t
 * @param {object} plugin_loader
 * @param {string} newurl
 * @param {boolean} noSignalOrDB
 * @returns {Promise<void>}
 */
const create_tenant = async ({
  t,
  plugin_loader,
  noSignalOrDB,
  loadAndSaveNewPlugin,
  tenant_template,
}: {
  t: string;
  plugin_loader: Function;
  noSignalOrDB?: boolean;
  loadAndSaveNewPlugin?: (plugin: Plugin) => void;
  tenant_template?: string;
}) => {
  await db.runWithTenant(t, plugin_loader);
  if (!noSignalOrDB) {
    if (tenant_template && loadAndSaveNewPlugin) {
      //create backup
      await copy_tenant_template({
        tenant_template,
        target: t,
        state: tenants[t],
        loadAndSaveNewPlugin,
      });
    }
    if (db.is_node) {
      // TODO ch
      process_send({ createTenant: t });
    }
  }
};

export = {
  create_tenant,
  insertTenant,
  switchToTenant,
  getAllTenants,
  getAllTenantRows,
  domain_sanitize,
  deleteTenant,
  eachTenant,
  copy_tenant_template,
};
