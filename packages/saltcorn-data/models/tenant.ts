/**
 * Tenant Management Data Layer Access
 * @category saltcorn-data
 * @module models/tenant
 * @subcategory models
 */
import db from "../db";
const reset = require("../db/reset_schema");
import { sqlsanitize } from "@saltcorn/db-common/internal";
import config from "./config";
const { setConfig } = config;
import { unlink } from "fs/promises";
import type { Plugin } from "@saltcorn/types/base_types";
import type { Row } from "@saltcorn/db-common/internal";

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
const createTenant =
  // TODO how to set names for arguments
  async (
    subdomain: string,
    newurl?: string,
    email?: string,
    description?: string
  ): Promise<void> => {
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
  };
const copy_tenant_template = async ({
  tenant_template,
  target,
  loadAndSaveNewPlugin,
}: {
  tenant_template: string;
  target: string;
  loadAndSaveNewPlugin: (plugin: Plugin) => void;
}) => {
  const { create_backup, restore } = await import("./backup");
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
const eachTenant = async (f: () => Promise<void>): Promise<void> => {
  await f();
  if (db.is_it_multi_tenant()) {
    const tenantList = await getAllTenants();
    for (const domain of tenantList) await db.runWithTenant(domain, f);
  }
};

export = {
  getAllTenants,
  getAllTenantRows,
  createTenant,
  domain_sanitize,
  deleteTenant,
  eachTenant,
  copy_tenant_template,
};
