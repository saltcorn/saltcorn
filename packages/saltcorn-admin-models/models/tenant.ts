/**
 * Tenant Management Data Layer Access
 * @category saltcorn-admin-models
 * @module tenant
 */
import db from "@saltcorn/data/db/index";
const reset = require("@saltcorn/data/db/reset_schema");
import {
  SelectOptions,
  sqlsanitize,
  Where,
} from "@saltcorn/db-common/internal";
import config from "@saltcorn/data/models/config";
const { setConfig } = config;
import { unlink } from "fs/promises";
import Plugin from "@saltcorn/data/models/plugin";
import File from "@saltcorn/data/models/file";
import type { Row } from "@saltcorn/db-common/internal";
import backup from "./backup";
const { create_backup, restore } = backup;
const { process_send } = require("@saltcorn/data/db/state");

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
  return db.select("_sc_tenants");
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
 * @param template
 * @returns {Promise<void>}
 */
const insertTenant = async (
  subdomain: string,
  email?: string,
  description?: string,
  template?: string
): Promise<string> => {
  // normalize domain name
  const saneDomain = domain_sanitize(subdomain);
  // add email
  const saneEmail = typeof email !== "undefined" ? email : "";
  // add description
  const saneDescription = typeof description !== "undefined" ? description : "";
  // add template
  const saneTemplate = typeof template !== "undefined" ? template : null;
  // add info about tenant into main site
  await db.insert(
    "_sc_tenants",
    {
      subdomain: saneDomain,
      email: saneEmail,
      description: saneDescription,
      template: saneTemplate,
      created: new Date(),
    },
    { noid: true }
  );
  // create tenant schema
  if (!db.isSQLite) await db.query(`CREATE SCHEMA "${saneDomain}";`);
  // ensure file store
  await File.ensure_file_store(saneDomain);
  return saneDomain;
};
/**
 * Switch to Tenant:
 * - change current base_url
 * @param domain tenant name (subdomain)
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
/**
 * Copy template data into tenant (target)
 * - create backup from template tenant
 * - restore backup to target tenant
 * - clean up user_id in files
 * - delete users (including sequence reset)
 *
 * @param tenant_template [String] - template tenant
 * @param target [String] - target tenant
 * @param state - unused
 * @param loadAndSaveNewPlugin
 */
const copy_tenant_template = async ({
  tenant_template,
  target,
  loadAndSaveNewPlugin,
}: {
  tenant_template: string;
  target: string;
  loadAndSaveNewPlugin: (plugin: Plugin) => void;
}) => {
  // TODO use a hygienic name for backup file
  // create backup of template backup
  const backupFile = await db.runWithTenant(tenant_template, create_backup);
  await db.runWithTenant(target, async () => {
    // restore backup to target tenant
    await restore(backupFile, loadAndSaveNewPlugin, true);

    // clean up user_id for files
    await db.updateWhere("_sc_files", { user_id: null }, {});
    // delete users in target tenant
    await db.deleteWhere("users", {});
    // reset of user sequence
    await db.reset_sequence("users");
    //
  });
  await unlink(backupFile);
};

/**
 * Delete Tenant
 * Note! This is deleting all tenant data in database!
 * - drop database schema
 * - delete information about tenant from main site
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
  sqlsanitize(s.replace(".", "").toLowerCase().substring(0, 128));

/**
 * Call function f for each Tenant
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
 * Create tenant? Not sure that is correct name
 * - load plugins
 * - use tenant template (copy structures from...)
 * @param {string} t
 * @param {object} plugin_loader
 * @param {string} newurl
 * @param {boolean} noSignalOrDB
 * @param {string} tenant_template
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
  loadAndSaveNewPlugin: (plugin: Plugin) => void;
  tenant_template?: string;
}) => {
  await db.runWithTenant(t, plugin_loader);
  if (!noSignalOrDB) {
    // todo - to check that is correct change
    //if (tenant_template && loadAndSaveNewPlugin) {
    if (tenant_template) {
      //create backup
      await copy_tenant_template({
        tenant_template,
        target: t,
        loadAndSaveNewPlugin,
      });
    }
    if (db.is_node) {
      // TODO ch
      process_send({ createTenant: t });
    }
  }
};

/**
 * Class Tenant
 */
class Tenant {
  // id?: number;
  subdomain: string;
  email: string;
  description: string;
  template: string;
  created: Date;
  //pack: Pack;
  //hash: string;

  /**
   * Library constructor
   * @param {object} o
   */
  constructor(o: Tenant) {
    //this.id = o.id;
    this.subdomain = o.subdomain;
    this.email = o.email;
    this.description = o.description;
    this.template = o.template;
    this.created = o.created;
    //this.created = o.created;
    //this.pack = o.pack;
    //this.hash = o.hash;
  }

  /**
   * Find Tenants
   * @param where
   * @param selectopts
   */
  static async find(
    where: Where,
    selectopts?: SelectOptions
  ): Promise<Tenant[]> {
    const us = await db.select("_sc_tenants", where, selectopts);
    return us.map((u: any) => new Tenant(u));
  }

  /**
   * Find one tenant
   * @param where
   */
  static async findOne(where: Where): Promise<Tenant | null> {
    const us = await db.select("_sc_tenants", where, { limit: 1 });
    if (us.length === 0) return null;
    else return new Tenant(us[0]);
  }

  /**
   * Update tenant
   * @param subdomain
   * @param row
   * @returns {Promise<void>}
   */
  static async update(subdomain: string, row: Row): Promise<void> {
    //await db.update("_sc_tenants", row, subdomain);
    await db.query(
      `update _sc_tenants set description = '${row.description}' where subdomain = '${subdomain}'`
    );
    //Object.assign(this, row);
    // todo trigger if need
  }
}

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
  Tenant,
};
