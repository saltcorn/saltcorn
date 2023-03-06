/**
 * State of Saltcorn
 * Keeps cache for main objects
 * @category saltcorn-data
 * @module db/state
 * @subcategory db
 */

import View from "../models/view";
import Trigger from "../models/trigger";
import File from "../models/file";
import Table from "../models/table";
import Page from "../models/page";
import Field from "../models/field";
import {
  Plugin,
  PluginLayout,
  ViewTemplate,
  MobileConfig,
} from "@saltcorn/types/base_types";
import { Type } from "@saltcorn/types/common_types";
import { ConfigTypes, SingleConfig } from "models/config";
import User from "../models/user";
const { PluginManager } = require("live-plugin-manager");

import moment from "moment";

import db from ".";
const { migrate } = require("../migrate");
import config from "../models/config";
const { getAllConfigOrDefaults, setConfig, deleteConfig, configTypes } = config;
const emergency_layout = require("@saltcorn/markup/emergency_layout");
import utils from "../utils";
const { structuredClone, removeAllWhiteSpace } = utils;
import I18n from "i18n";
import { join } from "path";
import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";

/**
 * @param v
 */
const process_send = (v: any) => {
  if (process.send) process.send(v);
};

const standard_fonts = {
  Arial: "Arial, Helvetica Neue, Helvetica, sans-serif",
  Baskerville:
    "Baskerville, Baskerville Old Face, Garamond, Times New Roman, serif",
  "Bodoni MT":
    "Bodoni MT, Bodoni 72, Didot, Didot LT STD, Hoefler Text, Garamond, Times New Roman, serif",
  Calibri: "Calibri, Candara, Segoe, Segoe UI, Optima, Arial, sans-serif",
  "Calisto MT":
    "Calisto MT, Bookman Old Style, Bookman, Goudy Old Style, Garamond, Hoefler Text, Bitstream Charter, Georgia, serif",
  Cambria: "Cambria, Georgia, serif",
  Candara: "Candara, Calibri, Segoe, Segoe UI, Optima, Arial, sans-serif",
  "Century Gothic": "Century Gothic, CenturyGothic, AppleGothic, sans-serif",
  Consolas: "Consolas, monaco, monospace",
  "Copperplate Gothic": "Copperplate, Copperplate Gothic Light, fantasy",
  "Courier New":
    "Courier New, Courier, Lucida Sans Typewriter, Lucida Typewriter, monospace",
  "Dejavu Sans": "Dejavu Sans, Arial, Verdana, sans-serif",
  Didot:
    "Didot, Didot LT STD, Hoefler Text, Garamond, Calisto MT, Times New Roman, serif",
  "Franklin Gothic": "Franklin Gothic, Arial Bold",
  Garamond:
    "Garamond, Baskerville, Baskerville Old Face, Hoefler Text, Times New Roman, serif",
  Georgia: "Georgia, Times, Times New Roman, serif",
  "Gill Sans": "Gill Sans, Gill Sans MT, Calibri, sans-serif",
  "Goudy Old Style":
    "Goudy Old Style, Garamond, Big Caslon, Times New Roman, serif",
  Helvetica: "Helvetica Neue, Helvetica, Arial, sans-serif",
  Impact:
    "Impact, Charcoal, Helvetica Inserat, Bitstream Vera Sans Bold, Arial Black, sans serif",
  "Lucida Bright": "Lucida Bright, Georgia, serif",
  "Lucida Sans": "Lucida Sans, Helvetica, Arial, sans-serif",
  Optima: "Optima, Segoe, Segoe UI, Candara, Calibri, Arial, sans-serif",
  Palatino:
    "Palatino, Palatino Linotype, Palatino LT STD, Book Antiqua, Georgia, serif",
  Perpetua:
    "Perpetua, Baskerville, Big Caslon, Palatino Linotype, Palatino, serif",
  Rockwell:
    "Rockwell, Courier Bold, Courier, Georgia, Times, Times New Roman, serif",
  "Segoe UI":
    "Segoe UI, Frutiger, Dejavu Sans, Helvetica Neue, Arial, sans-serif",
  Tahoma: "Tahoma, Verdana, Segoe, sans-serif",
  "Trebuchet MS":
    "Trebuchet MS, Lucida Grande, Lucida Sans Unicode, Lucida Sans, sans-serif",
  Verdana: "Verdana, Geneva, sans-serif",
};

/**
 * State Class
 * @category saltcorn-data
 */
class State {
  tenant: string;
  views: Array<View>;
  triggers: Array<Trigger>;
  virtual_triggers: Array<Trigger>;
  viewtemplates: Record<string, ViewTemplate>;
  tables: Array<Table>;
  types: Record<string, Type>;
  stashed_fieldviews: Record<string, any>;
  pages: Array<Page>;
  fields: Array<Field>;
  configs: ConfigTypes;
  fileviews: Record<string, any>;
  actions: Record<string, any>;
  auth_methods: Record<string, any>;
  plugins: Record<string, Plugin>;
  plugin_cfgs: any;
  plugin_locations: any;
  plugin_module_names: any;
  eventTypes: any;
  fonts: Record<string, string>;
  layouts: Record<string, PluginLayout>;
  headers: any;
  function_context: any;
  functions: any;
  keyFieldviews: any;
  external_tables: any;
  verifier: any;
  i18n: I18n.I18n;
  mobileConfig?: MobileConfig;
  logLevel: number;
  pluginManager?: any;
  codeNPMmodules: Record<string, any>;

  /**
   * State constructor
   * @param {string} tenant description
   */
  constructor(tenant: string) {
    this.tenant = tenant;
    this.views = [];
    this.triggers = [];
    this.virtual_triggers = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.stashed_fieldviews = {};
    this.pages = [];
    this.fields = [];
    this.configs = {};
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.plugins = {};
    this.plugin_cfgs = {};
    this.plugin_locations = {};
    this.plugin_module_names = {};
    this.eventTypes = {};
    this.fonts = standard_fonts;
    this.layouts = { emergency: { wrap: emergency_layout } };
    this.headers = {};
    this.function_context = { moment, slugify: db.slugify };
    this.functions = { moment, slugify: db.slugify };
    this.keyFieldviews = {};
    this.external_tables = {};
    this.verifier = null;
    this.i18n = new I18n.I18n();
    this.i18n.configure({
      locales: [],
      directory: join(__dirname, "..", "app-locales"),
    });
    this.logLevel = 1;
    this.codeNPMmodules = {};
  }

  /**
   * Get Layout by user
   * Based on role of user
   * @param {object} user
   * @returns {object}
   */
  getLayout(user: User) {
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
   * Get Two factor authentication policy
   * Based on role of user
   * @param {object} user
   * @returns {string}
   */
  get2FApolicy(user: User) {
    const role_id = user ? +user.role_id : 10;
    const twofa_policy_by_role = this.getConfig("twofa_policy_by_role");
    if (twofa_policy_by_role && twofa_policy_by_role[role_id])
      return twofa_policy_by_role[role_id];
    else return "Optional";
  }

  /**
   * Logging to console
   *
   * @param min_level
   * @param msg
   */
  log(min_level: number, msg: string) {
    if (min_level <= this.logLevel) {
      const ten = db.getTenantSchema();
      const s = `${ten !== "public" ? `Tenant=${ten} ` : ""}${msg}`;
      if (min_level === 1) console.error(s);
      else console.log(s);
    }
  }

  /**
   * Refresh State cache for all Saltcorn main objects
   * @param {boolean} noSignal - Do not signal - refresh to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh(noSignal: boolean) {
    await this.refresh_tables(noSignal);
    await this.refresh_views(noSignal);
    await this.refresh_triggers(noSignal);
    await this.refresh_pages(noSignal);
    await this.refresh_config(noSignal);
  }

  /**
   * Refresh config
   * @param {boolean} noSignal - Do not signal refresh to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_config(noSignal: boolean) {
    this.configs = await getAllConfigOrDefaults();
    this.getConfig("custom_events", []).forEach((cev: any) => {
      this.eventTypes[cev.name] = cev;
    });
    this.logLevel = +(this.configs.log_level.value || 1);
    if (!noSignal) this.log(5, "Refresh config");
    if (db.is_node) {
      // TODO ch mobile i18n
      await this.refresh_i18n();
    }
    if (!noSignal && db.is_node)
      process_send({ refresh: "config", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh i18n Internationalization
   * @returns {Promise<void>}
   */
  async refresh_i18n() {
    const localeDir = join(__dirname, "..", "app-locales", this.tenant);
    try {
      //avoid race condition
      if (!existsSync(localeDir)) await mkdir(localeDir, { recursive: true });
    } catch (e) {
      console.error("app-locale create error", e);
    }
    const allStrings = this.getConfig("localizer_strings", {});
    for (const lang of Object.keys(this.getConfig("localizer_languages", {}))) {
      //write json file
      const strings = allStrings[lang];
      if (strings)
        await writeFile(
          join(localeDir, `${lang}.json`),
          JSON.stringify(strings, null, 2)
        );
    }
    this.log(5, "Refresh i18n");

    this.i18n = new I18n.I18n();
    this.i18n.configure({
      locales: Object.keys(this.getConfig("localizer_languages", {})),
      directory: localeDir,
      autoReload: false,
      updateFiles: false,
      syncFiles: false,
    });
  }

  /**
   * Refresh views
   * @param {boolean} noSignal - Do not signal refresh to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_views(noSignal: boolean) {
    this.views = await View.find();
    this.virtual_triggers = [];
    for (const view of this.views) {
      if (view.viewtemplateObj && view.viewtemplateObj.virtual_triggers) {
        const trs = await view.viewtemplateObj.virtual_triggers(
          view.table_id,
          view.name,

          view.configuration
        );
        this.virtual_triggers.push(...trs);
      }
    }
    if (!noSignal) this.log(5, "Refresh views");

    if (!noSignal && db.is_node)
      process_send({ refresh: "views", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh triggers
   * @param {boolean} noSignal - Do not signal refresh to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_triggers(noSignal: boolean) {
    this.triggers = await Trigger.findDB();
    if (!noSignal) this.log(5, "Refresh triggers");

    if (!noSignal && db.is_node)
      process_send({ refresh: "triggers", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh pages
   * @param {boolean} noSignal - Do not signal refresh to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_pages(noSignal: boolean) {
    const Page = require("../models/page");
    this.pages = await Page.find();
    if (!noSignal) this.log(5, "Refresh pages");

    if (!noSignal && db.is_node)
      process_send({ refresh: "pages", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh tables list and table definitions (including fields) in State
   * @param {boolean} noSignal - Do not signal refresh to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_tables(noSignal?: boolean) {
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
      table.fields = allFields.filter((f: Field) => f.table_id === table.id);
      table.fields.forEach((f: Field) => {
        if (
          f.attributes &&
          f.attributes.localizes_field &&
          f.attributes.locale
        ) {
          const localized = table.fields.find(
            (lf: Field) => lf.name === f.attributes.localizes_field
          );
          if (localized) {
            if (!localized.attributes) localized.attributes = {};

            if (!localized.attributes.localized_by)
              localized.attributes.localized_by = {};

            localized.attributes.localized_by[f.attributes.locale] = f.name;
          }
        }
      });
    }
    this.tables = allTables;
    if (!noSignal) this.log(5, "Refresh table");

    if (!noSignal && db.is_node)
      process_send({ refresh: "tables", tenant: db.getTenantSchema() });
  }

  /**
   * Get config parameter by key
   * @param {string} key - key of config paramter
   * @param {*} [def] - default value
   * @returns {*}
   */
  getConfig(key: string, def?: any) {
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
   * Get copy of config parameter (which can be safely mutated)
   * @param {string} key - key of parameter
   * @param {*} [def] - default value
   * @returns {*}
   */
  getConfigCopy(key: string, def: any) {
    return structuredClone(this.getConfig(key, def));
  }

  /**
   *
   * Set value of config parameter
   * @param {string} key - key of parameter
   * @param {*} value - value of parameter
   * @returns {Promise<void>}
   */
  async setConfig(key: string, value: any) {
    if (
      !this.configs[key] ||
      typeof this.configs[key].value === "undefined" ||
      this.configs[key].value !== value
    ) {
      await setConfig(key, value);
      this.configs[key] = { value };
      if (key.startsWith("localizer_")) await this.refresh_i18n();
      if (db.is_node)
        process_send({ refresh: "config", tenant: db.getTenantSchema() });
      else {
        await this.refresh_config(true);
      }
    }
  }

  /**
   * Delete config parameter by key
   * @param {string} keys - key of parameter
   * @returns {Promise<void>}
   */
  async deleteConfig(...keys: string[]) {
    for (const key of keys) {
      await deleteConfig(key);
      delete this.configs[key];
    }
    if (db.is_node)
      process_send({ refresh: "config", tenant: db.getTenantSchema() });
    else {
      await this.refresh_config(true);
    }
  }

  /**
   * Register plugin
   * @param {string} name
   * @param {object} plugin
   * @param {*} cfg
   * @param {*} location
   * @param {string} modname
   * @returns {void}
   */
  registerPlugin(
    name: string,
    plugin: Plugin,
    cfg?: SingleConfig,
    location?: string,
    modname?: string
  ) {
    this.plugins[name] = plugin;
    this.plugin_cfgs[name] = cfg;
    if (location) this.plugin_locations[plugin.plugin_name || name] = location;
    this.headers[name] = [];
    if (modname) this.plugin_module_names[modname] = name;

    const withCfg = (key: string, def?: any) =>
      plugin.configuration_workflow
        ? plugin[key]
          ? plugin[key](cfg || {})
          : def
        : plugin[key] || def;

    withCfg("types", []).forEach((t: Type) => {
      this.addType(t);
    });
    withCfg("viewtemplates", []).forEach((vt: ViewTemplate) => {
      this.viewtemplates[vt.name] = vt;
    });
    Object.entries(withCfg("functions", {})).forEach(
      ([k, v]: [k: string, v: any]) => {
        this.functions[k] = v;
        this.function_context[k] = typeof v === "function" ? v : v.run;
      }
    );
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
    Object.entries(withCfg("external_tables", {})).forEach(
      ([k, v]: [k: string, v: any]) => {
        // TODO ch
        if (!v.name) v.name = k;
        this.external_tables[k] = v;
      }
    );
    Object.entries(withCfg("fieldviews", {})).forEach(
      ([k, v]: [k: string, v: any]) => {
        if (v.type === "Key") {
          this.keyFieldviews[k] = v;
          return;
        }
        const type = this.types[v.type];
        if (type) {
          if (type.fieldviews) type.fieldviews[k] = v;
          else type.fieldviews = { [k]: v };
        } else {
          if (!this.stashed_fieldviews[v.type])
            this.stashed_fieldviews[v.type] = {};
          this.stashed_fieldviews[v.type][k] = v;
        }
      }
    );
    const layout = withCfg("layout");
    if (layout) {
      // TOOO ch
      this.layouts[name] = layout;
    }
    const verifier = withCfg("verifier_workflow");
    if (verifier) {
      this.verifier = verifier;
    }
    withCfg("headers", []).forEach((h: any) => {
      if (!this.headers[name].includes(h)) this.headers[name].push(h);
    });
  }

  /**
   * Get type names
   * @type {string[]}
   */
  get type_names() {
    return Object.keys(this.types);
  }

  /**
   * Add type
   * @param {object} t
   */
  addType(t: Type) {
    if (this.types[t.name]) return;

    this.types[t.name] = {
      ...t,
      fieldviews: {
        ...t.fieldviews,
        ...(this.stashed_fieldviews[t.name] || {}),
      },
    };
  }

  /**
   * Remove plugin
   * @param {string} name
   * @param {boolean} noSignal - Do not signal removal to other cluster processes.
   * @returns {Promise<void>}
   */
  async remove_plugin(name: string, noSignal: boolean) {
    delete this.plugins[name];
    await this.refresh_plugins();
    if (!noSignal && db.is_node)
      process_send({ removePlugin: name, tenant: db.getTenantSchema() });
  }

  /**
   * Reload plugins
   * @param {boolean} noSignal - Do not signal reload to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_plugins(noSignal?: boolean) {
    this.viewtemplates = {};
    this.types = {};
    this.stashed_fieldviews = {};
    this.fields = [];
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.layouts = { emergency: { wrap: emergency_layout } };
    this.headers = {};
    this.function_context = { moment, slugify: db.slugify };
    this.functions = { moment, slugify: db.slugify };
    this.keyFieldviews = {};
    this.external_tables = {};
    this.eventTypes = {};
    this.verifier = null;
    this.fonts = standard_fonts;
    Object.entries(this.plugins).forEach(([k, v]: [k: string, v: Plugin]) => {
      this.registerPlugin(k, v, this.plugin_cfgs[k]);
    });
    await this.refresh(true);
    if (!noSignal && db.is_node)
      process_send({ refresh: "plugins", tenant: db.getTenantSchema() });
  }

  /**
   * Collect translatable strings from configuration
   * @returns {string[]}
   */
  getStringsForI18n() {
    const strings = [];
    this.views.forEach((v) => strings.push(...v.getStringsForI18n()));
    this.pages.forEach((p) => strings.push(...p.getStringsForI18n()));
    const menu = this.getConfig("menu_items", []);
    strings.push(...menu.map(({ label }: { label: string }) => label));
    return Array.from(new Set(strings)).filter(
      (s) => s && removeAllWhiteSpace(s)
    );
  }

  /**
   * Set the function which will be called when a message enters a room
   * @param {function} f
   */
  setRoomEmitter(f: Function) {
    globalRoomEmitter = f;
  }

  /**
   * Send a message to a room
   * @param {...*} args
   */
  emitRoom(...args: any[]) {
    globalRoomEmitter(...args);
  }
  async loadNPMpkgsForJsCode(moduleStr: string) {
    if (!moduleStr) return;
    const moduleNames = moduleStr.split(",").map((s) => s.trim());
    if (moduleNames.length === 0) return;
    if (!this.pluginManager) this.pluginManager = new PluginManager();
    for (const moduleName of moduleNames) {
      if (moduleName) {
        try {
          await this.pluginManager.install(moduleName);
          this.codeNPMmodules[moduleName] =
            this.pluginManager.require(moduleName);
        } catch (e) {
          console.error(e);
        }
      }
    }
  }
}

/**
 * Global
 */
let globalRoomEmitter: Function = () => {};

// the root tenant's state is singleton
const singleton = new State("public");

// return current State object

/**
 * Get the state in the current tenant
 * @function
 * @returns {State}
 */
const getState = (): State | undefined => {
  if (!db.is_it_multi_tenant()) return singleton;

  const ten = db.getTenantSchema();
  if (ten === db.connectObj.default_schema) return singleton;
  else return tenants[ten];
};
// list of all tenants
const tenants: Record<string, State> = { public: singleton };
// list of tenants with other domains
const otherdomaintenants: Record<string, string> = {};

/**
 * Get tenant that has another domain (not subdomain)
 * @param {string} hostname
 * @returns {object}
 */
const get_other_domain_tenant = (hostname: string) =>
  otherdomaintenants[hostname];
/**
 * Get tenant from State
 * @param {string} ten
 * @returns {object}
 */
const getTenant = (ten: string) => {
  //console.log({ ten, tenants });
  return tenants[ten];
};

const getRootState = () => singleton;
/**
 * Returns all Tenants (from State)
 */
const getAllTenants = () => tenants;
/**
 * Remove protocol (http:// or https://) from domain url
 * @param {string} url
 * @returns {string}
 */
const get_domain = (url: string): string => {
  const noproto = url.replace("https://", "").replace("http://", "");
  return noproto.split("/")[0].split(":")[0];
};
/**
 * Set tenant base url???
 * From my point of view it just add tenant to list of otherdomaintenant
 * @param {object} tenant_subdomain
 * @param {string} [value] - new
 */
const set_tenant_base_url = (tenant_subdomain: string, value?: string) => {
  const root_domain = get_domain(singleton.configs.base_url.value);
  if (value) {
    const cfg_domain = get_domain(value);
    if (!cfg_domain.includes("." + root_domain))
      otherdomaintenants[cfg_domain] = tenant_subdomain;
  }
};
/**
 * Switch to multi_tenant
 * @param {object} plugin_loader
 * @param {boolean} disableMigrate - if true then dont migrate db
 * @param {string[]} tenantList
 * @returns {Promise<void>}
 */
const init_multi_tenant = async (
  plugin_loader: Function,
  disableMigrate: boolean,
  tenantList: string[]
) => {
  // for each domain
  for (const domain of tenantList) {
    try {
      // create new state for each domain
      tenants[domain] = new State(domain);
      // make migration
      if (!disableMigrate)
        await db.runWithTenant(domain, () => migrate(domain, true));
      // load plugins
      await db.runWithTenant(domain, plugin_loader);
      // set base_url
      set_tenant_base_url(domain, tenants[domain].configs.base_url?.value);
      await tenants[domain].loadNPMpkgsForJsCode(
        tenants[domain].configs.npm_available_js_code?.value
      );
    } catch (err: any) {
      console.error(
        `init_multi_tenant error in domain ${domain}: `,
        err.message
      );
    }
  }
};
/**
 * Add tenant to State
 * @param t
 */
const add_tenant = (t: string) => {
  tenants[t] = new State(t);
};

/**
 * Restart tenant (means reload of plugins)
 * @param {object} plugin_loader
 * @returns {Promise<void>}
 */
const restart_tenant = async (plugin_loader: Function) => {
  const ten = db.getTenantSchema();
  tenants[ten] = new State(ten);
  await plugin_loader();
};
/**
 * Process init time constant
 */
const process_init_time = new Date();
/**
 * Get Process Init Time - moment when Saltcorn process was initiated
 * @returns {Date}
 */
const get_process_init_time = () => process_init_time;
/**
 * State Features
 */
const features = {
  serve_static_dependencies: true,
  deep_public_plugin_serve: true,
  fieldrepeats_in_field_attributes: true,
  no_plugin_fieldview_length_check: true,
  bootstrap5: true,
  version_plugin_serve_path: true,
  prefix_or_in_queries: true,
  json_state_query: true,
  async_validate: true,
};

export = {
  getState,
  getTenant,
  init_multi_tenant,
  restart_tenant,
  get_other_domain_tenant,
  set_tenant_base_url,
  get_process_init_time,
  features,
  add_tenant,
  getAllTenants,
  process_send,
  getRootState,
};
