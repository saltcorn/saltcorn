/**
 * State of Saltcorn
 * Keeps cache for main objects
 */

const { contract, is } = require("contractis");
const {
  is_plugin_wrap,
  is_plugin,
  is_header,
  is_viewtemplate,
  is_plugin_type,
  is_plugin_layout,
} = require("../contracts");
const moment = require("moment");

const db = require(".");
const { migrate } = require("../migrate");
const File = require("../models/file");
const Trigger = require("../models/trigger");
const View = require("../models/view");
const { getAllTenants, createTenant } = require("../models/tenant");
const {
  getAllConfigOrDefaults,
  setConfig,
  deleteConfig,
  configTypes,
} = require("../models/config");
const emergency_layout = require("@saltcorn/markup/emergency_layout");
const { structuredClone } = require("../utils");
const { I18n } = require("i18n");
const path = require("path");
const fs = require("fs");

process.send = process.send || function () {};

/**
 * State class
 */
class State {
  constructor(tenant) {
    this.tenant = tenant;
    this.views = [];
    this.triggers = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.files = {};
    this.pages = [];
    this.fields = [];
    this.configs = {};
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.plugins = {};
    this.plugin_cfgs = {};
    this.plugin_locations = {};
    this.eventTypes = {};
    this.layouts = { emergency: { wrap: emergency_layout } };
    this.headers = [];
    this.function_context = { moment };
    this.functions = { moment };
    this.keyFieldviews = {};
    this.external_tables = {};
    this.verifier = null;
    this.i18n = new I18n({
      locales: [],
      directory: path.join(__dirname, "..", "app-locales"),
    });
    contract.class(this);
  }

  /**
   * Get Layout by user
   * Based on role of user
   * @param user
   * @returns {unknown}
   */
  getLayout(user) {
    const role_id = user ? +user.role_id : 10;
    const layout_by_role = this.getConfig("layout_by_role");
    if (layout_by_role && layout_by_role[role_id]) {
      const chosen = this.layouts[layout_by_role[role_id]];
      if (chosen) return chosen;
    }
    const layoutvs = Object.values(this.layouts);
    return layoutvs[layoutvs.length - 1];
  }

  /**
   * Refresh State cache for all Saltcorn main objects
   * @returns {Promise<void>}
   */
  async refresh(noSignal) {
    await this.refresh_views(noSignal);
    await this.refresh_triggers(noSignal);
    await this.refresh_tables(noSignal);
    await this.refresh_files(noSignal);
    await this.refresh_pages(noSignal);
    await this.refresh_config(noSignal);
  }
  /**
   * Refresh config
   * @returns {Promise<void>}
   */
  async refresh_config(noSignal) {
    this.configs = await getAllConfigOrDefaults();
    this.getConfig("custom_events", []).forEach((cev) => {
      this.eventTypes[cev.name] = cev;
    });
    const localeDir = path.join(__dirname, "..", "app-locales", this.tenant);
    try {
      //avoid race condition
      if (!fs.existsSync(localeDir)) await fs.promises.mkdir(localeDir);
    } catch {}
    const allStrings = this.getConfig("localizer_strings", {});
    for (const lang of Object.keys(this.getConfig("localizer_languages", {}))) {
      //write json file
      const strings = allStrings[lang];
      if (strings)
        await fs.writeFile(
          path.join(localeDir, `${lang}.json`),
          JSON.stringify(strings)
        );
    }
    this.i18n = new I18n({
      locales: Object.keys(this.getConfig("localizer_languages", {})),
      directory: localeDir,
      autoReload: false,
      updateFiles: false,
      syncFiles: false,
    });
    if (!noSignal)
      process.send({ refresh: "config", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh views
   * @returns {Promise<void>}
   */
  async refresh_views(noSignal) {
    this.views = await View.find();
    if (!noSignal)
      process.send({ refresh: "views", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh triggers
   * @returns {Promise<void>}
   */
  async refresh_triggers(noSignal) {
    this.triggers = await Trigger.findDB();
    if (!noSignal)
      process.send({ refresh: "triggers", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh pages
   * @returns {Promise<void>}
   */
  async refresh_pages(noSignal) {
    const Page = require("../models/page");
    this.pages = await Page.find();
    if (!noSignal)
      process.send({ refresh: "pages", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh files
   * @returns {Promise<void>}
   */
  // todo what will be if there are a lot of files? Yes, there are cache only ids of files.
  async refresh_files(noSignal) {
    const allfiles = await File.find();
    this.files = {};
    for (const f of allfiles) {
      this.files[f.id] = f;
    }
    if (!noSignal)
      process.send({ refresh: "files", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh tables & fields
   * @returns {Promise<void>}
   */
  async refresh_tables(noSignal) {
    const allTables = await db.select(
      "_sc_tables",
      {},
      { orderBy: "name", nocase: true }
    );
    const allFields = await db.select(
      "_sc_fields",
      {},
      { orderBy: "name", nocase: true }
    );
    for (const table of allTables) {
      table.fields = allFields.filter((f) => f.table_id === table.id);
    }
    this.tables = allTables;
    if (!noSignal)
      process.send({ refresh: "tables", tenant: db.getTenantSchema() });
  }

  /**
   * Get config parameter by key
   * @param key - key of config paramter
   * @param def - default value
   * @returns {*}
   */
  getConfig(key, def) {
    const fixed = db.connectObj.fixed_configuration[key];
    if (typeof fixed !== "undefined") return fixed;
    if (db.connectObj.inherit_configuration.includes(key)) {
      if (typeof singleton.configs[key] !== "undefined")
        return singleton.configs[key].value;
      else return def || configTypes[key].default;
    }
    if (this.configs[key] && typeof this.configs[key].value !== "undefined")
      return this.configs[key].value;
    if (def) return def;
    else return configTypes[key] && configTypes[key].default;
  }

  /**
   * Get copy of config parameter
   * @param key - key of parameter
   * @param def - default value
   * @returns {any}
   */
  getConfigCopy(key, def) {
    return structuredClone(this.getConfig(key, def));
  }

  /**
   *
   * Set value of config parameter
   * @param key - key of parameter
   * @param value - value of parameter
   * @returns {Promise<void>}
   */
  async setConfig(key, value) {
    if (
      !this.configs[key] ||
      typeof this.configs[key].value === "undefined" ||
      this.configs[key].value !== value
    ) {
      await setConfig(key, value);
      this.configs[key] = { value };
      process.send({ refresh: "config", tenant: db.getTenantSchema() });
    }
  }

  /**
   * Delete config parameter by key
   * @param key - key of parameter
   * @returns {Promise<void>}
   */
  async deleteConfig(...keys) {
    for (const key of keys) {
      await deleteConfig(key);
      delete this.configs[key];
    }
    process.send({ refresh: "config", tenant: db.getTenantSchema() });
  }

  /**
   * Registre plugin
   * @param name
   * @param plugin
   * @param cfg
   * @param location
   */
  registerPlugin(name, plugin, cfg, location) {
    this.plugins[name] = plugin;
    this.plugin_cfgs[name] = cfg;
    this.plugin_locations[plugin.plugin_name || name] = location;

    const withCfg = (key, def) =>
      plugin.configuration_workflow
        ? plugin[key]
          ? plugin[key](cfg || {})
          : def
        : plugin[key] || def;

    withCfg("types", []).forEach((t) => {
      this.addType(t);
    });
    withCfg("viewtemplates", []).forEach((vt) => {
      this.viewtemplates[vt.name] = vt;
    });
    Object.entries(withCfg("functions", {})).forEach(([k, v]) => {
      this.functions[k] = v;
      this.function_context[k] = typeof v === "function" ? v : v.run;
    });
    Object.entries(withCfg("fileviews", {})).forEach(([k, v]) => {
      this.fileviews[k] = v;
    });
    Object.entries(withCfg("actions", {})).forEach(([k, v]) => {
      this.actions[k] = v;
    });
    Object.entries(withCfg("eventTypes", {})).forEach(([k, v]) => {
      this.eventTypes[k] = v;
    });
    Object.entries(withCfg("authentication", {})).forEach(([k, v]) => {
      this.auth_methods[k] = v;
    });
    Object.entries(withCfg("external_tables", {})).forEach(([k, v]) => {
      if (!v.name) v.name = k;
      this.external_tables[k] = v;
    });
    Object.entries(withCfg("fieldviews", {})).forEach(([k, v]) => {
      if (v.type === "Key") {
        this.keyFieldviews[k] = v;
        return;
      }
      const type = this.types[v.type];
      if (type) {
        if (type.fieldviews) type.fieldviews[k] = v;
        else type.fieldviews = { [k]: v };
      }
    });
    const layout = withCfg("layout");
    if (layout) {
      this.layouts[name] = contract(is_plugin_layout, layout);
    }
    const verifier = withCfg("verifier_workflow");
    if (verifier) {
      this.verifier = verifier;
    }
    withCfg("headers", []).forEach((h) => {
      if (!this.headers.includes(h)) this.headers.push(h);
    });
  }

  /**
   * Get type names
   * @returns {string[]}
   */
  get type_names() {
    return Object.keys(this.types);
  }

  /**
   * Add type
   * @param t
   */
  addType(t) {
    this.types[t.name] = { ...t, fieldviews: { ...t.fieldviews } };
  }

  /**
   * Remove plugin
   * @param name
   * @returns {Promise<void>}
   */
  async remove_plugin(name, noSignal) {
    delete this.plugins[name];
    await this.refresh_plugins();
    if (!noSignal)
      process.send({ removePlugin: name, tenant: db.getTenantSchema() });
  }

  /**
   * Reload plugins
   * @returns {Promise<void>}
   */
  async refresh_plugins(noSignal) {
    this.viewtemplates = {};
    this.types = {};
    this.fields = [];
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.layouts = { emergency: { wrap: emergency_layout } };
    this.headers = [];
    this.function_context = { moment };
    this.functions = { moment };
    this.keyFieldviews = {};
    this.external_tables = {};
    this.eventTypes = {};
    this.verifier = null;
    Object.entries(this.plugins).forEach(([k, v]) => {
      this.registerPlugin(k, v, this.plugin_cfgs[k]);
    });
    await this.refresh(true);
    if (!noSignal)
      process.send({ refresh: "plugins", tenant: db.getTenantSchema() });
  }
}

/**
 * State constract
 * @type {{variables: {headers: ((function(*=): *)|*), types: ((function(*=): *)|*), viewtemplates: ((function(*=): *)|*)}, methods: {addType: ((function(*=): *)|*), registerPlugin: ((function(*=): *)|*), type_names: ((function(*=): *)|*), refresh: ((function(*=): *)|*)}}}
 */
State.contract = {
  variables: {
    headers: is.array(is_header),
    viewtemplates: is.objVals(is_viewtemplate),
    types: is.objVals(is_plugin_type),
  },
  methods: {
    addType: is.fun(is_plugin_type, is.eq(undefined)),
    registerPlugin: is.fun([is.str, is_plugin], is.eq(undefined)),
    refresh: is.fun([], is.promise(is.eq(undefined))),
    type_names: is.getter(is.array(is.str)),
  },
};

// the state is singleton
const singleton = new State("public");

// return current State object
const getState = contract(
  is.fun([], is.or(is.class("State"), is.eq(undefined))),
  () => {
    if (!db.is_it_multi_tenant()) return singleton;

    const ten = db.getTenantSchema();
    if (ten === db.connectObj.default_schema) return singleton;
    else return tenants[ten];
  }
);
// list of all tenants
var tenants = {};
// list of tenants with other domains
const otherdomaintenants = {};
/**
 * Get other domain tenant
 * @param hostname
 */
const get_other_domain_tenant = (hostname) => otherdomaintenants[hostname];
/**
 * Get tenant
 * @param ten
 */
const getTenant = (ten) => {
  //console.log({ ten, tenants });
  return tenants[ten];
};
/**
 * Remove protocol (http:// or https://) from domain url
 * @param url
 * @returns {*}
 */
const get_domain = (url) => {
  const noproto = url.replace("https://", "").replace("http://", "");
  return noproto.split("/")[0].split(":")[0];
};
/**
 * Set tenant base url???
 * From my point of view it just add tenant to list of otherdomaintenant
 * @param tenant_subdomain
 * @param value - new
 */
const set_tenant_base_url = (tenant_subdomain, value) => {
  const root_domain = get_domain(singleton.configs.base_url.value);
  if (value) {
    const cfg_domain = get_domain(value);
    if (!cfg_domain.includes("." + root_domain))
      otherdomaintenants[cfg_domain] = tenant_subdomain;
  }
};
/**
 * Switch to multi_tenant
 * @param plugin_loader
 * @param disableMigrate - if true then dont migrate db
 * @returns {Promise<void>}
 */
const init_multi_tenant = async (plugin_loader, disableMigrate) => {
  const tenantList = await getAllTenants();
  for (const domain of tenantList) {
    try {
      tenants[domain] = new State(domain);
      if (!disableMigrate)
        await db.runWithTenant(domain, () => migrate(domain, true));
      await db.runWithTenant(domain, plugin_loader);
      set_tenant_base_url(domain, tenants[domain].configs.base_url.value);
    } catch (err) {
      console.error(
        `init_multi_tenant error in domain ${domain}: `,
        err.message
      );
    }
  }
};
/**
 * Create tenant
 * @param t
 * @param plugin_loader
 * @param newurl
 * @returns {Promise<void>}
 */
const create_tenant = async (t, plugin_loader, newurl, noSignalOrDB) => {
  if (!noSignalOrDB) await createTenant(t, newurl);
  tenants[t] = new State(t);
  await db.runWithTenant(t, plugin_loader);
  if (!noSignalOrDB) process.send({ createTenant: t });
};
/**
 * Restart tenant
 * @param plugin_loader
 * @returns {Promise<void>}
 */
const restart_tenant = async (plugin_loader) => {
  const ten = db.getTenantSchema();
  tenants[ten] = new State(ten);
  await plugin_loader();
};

const process_init_time = new Date();
/**
 * Get Process Init Time - moment when Saltcorn process was initiated
 * @returns {Date}
 */
const get_process_init_time = () => process_init_time;

const features = { serve_static_dependencies: true };

module.exports = {
  getState,
  getTenant,
  init_multi_tenant,
  create_tenant,
  restart_tenant,
  get_other_domain_tenant,
  set_tenant_base_url,
  get_process_init_time,
  features,
};
