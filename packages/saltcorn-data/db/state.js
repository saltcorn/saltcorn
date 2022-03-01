/**
 * State of Saltcorn
 * Keeps cache for main objects
 * @category saltcorn-data
 * @module db/state
 * @subcategory db
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
const {
  getAllConfigOrDefaults,
  setConfig,
  deleteConfig,
  configTypes,
} = require("../models/config");
const emergency_layout = require("@saltcorn/markup/emergency_layout");
const { structuredClone, removeAllWhiteSpace } = require("../utils");
const { I18n } = require("i18n");
const path = require("path");
const fs = require("fs");

/**
 * @param {object} v
 * @returns {void}
 */
const process_send = (v) => {
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
  /**
   * State constructor
   * @param {string} tenant description
   */
  constructor(tenant) {
    this.tenant = tenant;
    this.views = [];
    this.triggers = [];
    this.virtual_triggers = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.stashed_fieldviews = {};
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
    this.i18n = new I18n({
      locales: [],
      directory: path.join(__dirname, "..", "app-locales"),
    });
    contract.class(this);
  }

  /**
   * Get Layout by user
   * Based on role of user
   * @param {object} user
   * @returns {object}
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

  get2FApolicy(user) {
    const role_id = user ? +user.role_id : 10;
    const twofa_policy_by_role = this.getConfig("twofa_policy_by_role");
    if (twofa_policy_by_role && twofa_policy_by_role[role_id])
      return twofa_policy_by_role[role_id];
    else return "Optional";
  }

  /**
   * Refresh State cache for all Saltcorn main objects
   * @param {boolean} noSignal
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
   * @param {boolean} noSignal
   * @returns {Promise<void>}
   */
  async refresh_config(noSignal) {
    this.configs = await getAllConfigOrDefaults();
    this.getConfig("custom_events", []).forEach((cev) => {
      this.eventTypes[cev.name] = cev;
    });
    this.refresh_i18n();
    if (!noSignal)
      process_send({ refresh: "config", tenant: db.getTenantSchema() });
  }

  /**
   * @returns {Promise<void>}
   */
  async refresh_i18n() {
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
        await fs.promises.writeFile(
          path.join(localeDir, `${lang}.json`),
          JSON.stringify(strings, null, 2)
        );
    }
    this.i18n = new I18n({
      locales: Object.keys(this.getConfig("localizer_languages", {})),
      directory: localeDir,
      autoReload: false,
      updateFiles: false,
      syncFiles: false,
    });
  }

  /**
   * Refresh views
   * @param {boolean} noSignal
   * @returns {Promise<void>}
   */
  async refresh_views(noSignal) {
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
    if (!noSignal)
      process_send({ refresh: "views", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh triggers
   * @param {boolean} noSignal
   * @returns {Promise<void>}
   */
  async refresh_triggers(noSignal) {
    this.triggers = await Trigger.findDB();
    if (!noSignal)
      process_send({ refresh: "triggers", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh pages
   * @param {boolean} noSignal
   * @returns {Promise<void>}
   */
  async refresh_pages(noSignal) {
    const Page = require("../models/page");
    this.pages = await Page.find();
    if (!noSignal)
      process_send({ refresh: "pages", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh files
   * @param {boolean} noSignal
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
      process_send({ refresh: "files", tenant: db.getTenantSchema() });
  }

  /**
   * Refresh tables & fields
   * @param {boolean} noSignal
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
      table.fields.forEach((f) => {
        if (
          f.attributes &&
          f.attributes.localizes_field &&
          f.attributes.locale
        ) {
          const localized = table.fields.find(
            (lf) => lf.name === f.attributes.localizes_field
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
    if (!noSignal)
      process_send({ refresh: "tables", tenant: db.getTenantSchema() });
  }

  /**
   * Get config parameter by key
   * @param {string} key - key of config paramter
   * @param {string} [def] - default value
   * @returns {string}
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
   * @param {sring} key - key of parameter
   * @param {string} [def] - default value
   * @returns {string}
   */
  getConfigCopy(key, def) {
    return structuredClone(this.getConfig(key, def));
  }

  /**
   *
   * Set value of config parameter
   * @param {string} key - key of parameter
   * @param {string} value - value of parameter
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
      if (key.startsWith("localizer_")) this.refresh_i18n();
      process_send({ refresh: "config", tenant: db.getTenantSchema() });
    }
  }

  /**
   * Delete config parameter by key
   * @param {string} key - key of parameter
   * @returns {Promise<void>}
   */
  async deleteConfig(...keys) {
    for (const key of keys) {
      await deleteConfig(key);
      delete this.configs[key];
    }
    process_send({ refresh: "config", tenant: db.getTenantSchema() });
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
  registerPlugin(name, plugin, cfg, location, modname) {
    this.plugins[name] = plugin;
    this.plugin_cfgs[name] = cfg;
    if (location) this.plugin_locations[plugin.plugin_name || name] = location;
    this.headers[name] = [];
    if (modname) this.plugin_module_names[modname] = name;

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
      } else {
        if (!this.stashed_fieldviews[v.type])
          this.stashed_fieldviews[v.type] = {};
        this.stashed_fieldviews[v.type][k] = v;
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
  addType(t) {
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
   * @param {boolean} noSignal
   * @returns {Promise<void>}
   */
  async remove_plugin(name, noSignal) {
    delete this.plugins[name];
    await this.refresh_plugins();
    if (!noSignal)
      process_send({ removePlugin: name, tenant: db.getTenantSchema() });
  }

  /**
   * Reload plugins
   * @param {boolean} noSignal
   * @returns {Promise<void>}
   */
  async refresh_plugins(noSignal) {
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

    Object.entries(this.plugins).forEach(([k, v]) => {
      this.registerPlugin(k, v, this.plugin_cfgs[k]);
    });
    await this.refresh(true);
    if (!noSignal)
      process_send({ refresh: "plugins", tenant: db.getTenantSchema() });
  }

  /**
   * @returns {string[]}
   */
  getStringsForI18n() {
    const strings = [];
    this.views.forEach((v) => strings.push(...v.getStringsForI18n()));
    this.pages.forEach((p) => strings.push(...p.getStringsForI18n()));
    const menu = this.getConfig("menu_items", []);
    strings.push(...menu.map(({ label }) => label));
    return Array.from(new Set(strings)).filter(
      (s) => s && removeAllWhiteSpace(s)
    );
  }

  /**
   *
   * @param {function} f
   */
  setRoomEmitter(f) {
    this.roomEmitter = f;
  }

  /**
   *
   * @param {*} args
   */
  emitRoom(...args) {
    if (this.roomEmitter) this.roomEmitter(...args);
  }
}

/**
 * State constract
 * @type {{variables: {headers: ((function(*=): *)|*), types: ((function(*=): *)|*), viewtemplates: ((function(*=): *)|*)}, methods: {addType: ((function(*=): *)|*), registerPlugin: ((function(*=): *)|*), type_names: ((function(*=): *)|*), refresh: ((function(*=): *)|*)}}}
 */
State.contract = {
  variables: {
    headers: is.any,
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

/**
 * @function
 * @returns {State}
 */
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
var tenants = { public: singleton };
// list of tenants with other domains
const otherdomaintenants = {};

/**
 * Get other domain tenant
 * @param {string} hostname
 * @returns {object}
 */
const get_other_domain_tenant = (hostname) => otherdomaintenants[hostname];
/**
 * Get tenant
 * @param {string} ten
 * @returns {object}
 */
const getTenant = (ten) => {
  //console.log({ ten, tenants });
  return tenants[ten];
};
/**
 * Remove protocol (http:// or https://) from domain url
 * @param {string} url
 * @returns {string}
 */
const get_domain = (url) => {
  const noproto = url.replace("https://", "").replace("http://", "");
  return noproto.split("/")[0].split(":")[0];
};
/**
 * Set tenant base url???
 * From my point of view it just add tenant to list of otherdomaintenant
 * @param {object} tenant_subdomain
 * @param {string} [value] - new
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
 * @param {object} plugin_loader
 * @param {boolean} disableMigrate - if true then dont migrate db
 * @returns {Promise<void>}
 */
const init_multi_tenant = async (plugin_loader, disableMigrate, tenantList) => {
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

const add_tenant = (t) => {
  tenants[t] = new State(t);
};

/**
 * Restart tenant
 * @param {object} plugin_loader
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

const features = {
  serve_static_dependencies: true,
  deep_public_plugin_serve: true,
  fieldrepeats_in_field_attributes: true,
  no_plugin_fieldview_length_check: true,
  bootstrap5: true,
};

module.exports = {
  getState,
  getTenant,
  init_multi_tenant,
  restart_tenant,
  get_other_domain_tenant,
  set_tenant_base_url,
  get_process_init_time,
  features,
  add_tenant,
  process_send,
};
