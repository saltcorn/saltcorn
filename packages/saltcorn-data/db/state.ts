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
import TableConstraint from "../models/table_constraints";
import Page from "../models/page";
import PageGroup from "../models/page_group";
import Field from "../models/field";
import {
  Plugin,
  PluginLayout,
  ViewTemplate,
  MobileConfig,
  PluginRoute,
  Header,
  PluginFunction,
  TableProvider,
  ModelPattern,
  FieldView,
  Action,
  AuthenticationMethod,
  CopilotSkill,
} from "@saltcorn/types/base_types";
import { Type } from "@saltcorn/types/common_types";
import type { ConfigTypes, SingleConfig } from "../models/config";
import User from "../models/user";
const { PluginManager } = require("live-plugin-manager");

import moment from "moment";

import db from ".";
const { migrate } = require("../migrate");
import config from "../models/config";
const { getAllConfig, setConfig, deleteConfig, configTypes } = config;
const emergency_layout = require("@saltcorn/markup/emergency_layout");
import utils from "../utils";
const {
  structuredClone,
  removeAllWhiteSpace,
  stringToJSON,
  sleep,
  interpolate,
  isNode,
  flatEqual,
} = utils;
import I18n from "i18n";
import { tz } from "moment-timezone";
import { join } from "path";
import { existsSync } from "fs";
import { writeFile, mkdir } from "fs/promises";
import { runInContext, createContext } from "vm";
import faIcons from "./fa5-icons";
import { AbstractTable } from "@saltcorn/types/model-abstracts/abstract_table";

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

const get_standard_icons = () => {
  const icons = [...faIcons];
  icons.push(
    "unicode-2605-black-star",
    "unicode-2606-white-star",
    "unicode-2608-thunderstorm"
  );
  return icons;
};

const withRenderBody = (layouts: any) => {
  for (let i = layouts.length - 1; i >= 0; i--)
    if (layouts[i].renderBody) return layouts[i];
  throw new Error("No layout with renderBody found");
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
  modelpatterns: Record<string, ModelPattern>;
  tables: Array<Table>;
  types: Record<string, Type>;
  stashed_fieldviews: Record<string, Record<string, FieldView>>;
  pages: Array<Page>;
  page_groups: Array<PageGroup>;
  fields: Array<Field>;
  configs: ConfigTypes;
  fileviews: Record<string, FieldView>;
  actions: Record<string, Action>;
  auth_methods: Record<string, AuthenticationMethod>;
  plugins: Record<string, Plugin>;
  table_providers: Record<string, TableProvider>;
  plugin_cfgs: Record<string, any>;
  plugin_locations: any;
  plugin_module_names: any;
  plugin_routes: Record<string, Array<PluginRoute>>;
  routesChangedCb?: Function;
  eventTypes: Record<string, { hasChannel: boolean; name?: string }>;
  fonts: Record<string, string>;
  icons: Array<string>;
  layouts: Record<string, PluginLayout>;
  userLayouts: Record<string, PluginLayout>;
  headers: Record<string, Array<Header>>;
  function_context: Record<string, Function>;
  codepage_context: Record<string, unknown>;
  plugins_cfg_context: any;
  functions: Record<string, Function | PluginFunction>;
  keyFieldviews: Record<string, unknown>;
  external_tables: Record<string, AbstractTable>;
  verifier: any;
  i18n: I18n.I18n;
  mobileConfig?: MobileConfig;
  logLevel: number;
  pluginManager?: any;
  codeNPMmodules: Record<string, any>;
  npm_refresh_in_progess: boolean;
  hasJoinedLogSockets: boolean;
  queriesCache?: Record<string, any>;
  scVersion: string;
  waitingWorkflows?: boolean;
  keyframes: Array<string>;
  copilot_skills: Record<string, CopilotSkill>;

  private oldCodePages: Record<string, string> | undefined;

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
    this.modelpatterns = {};
    this.tables = [];
    this.types = {};
    this.stashed_fieldviews = {};
    this.pages = [];
    this.page_groups = [];
    this.fields = [];
    this.configs = {};
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.plugins = {};
    this.plugin_cfgs = {};
    this.plugin_locations = {};
    this.plugin_module_names = {};
    this.plugin_routes = {};
    this.table_providers = {};
    this.copilot_skills = {};
    this.eventTypes = {};
    this.fonts = standard_fonts;
    this.icons = get_standard_icons();
    this.layouts = { emergency: emergency_layout };
    this.userLayouts = {};
    this.headers = {};
    this.function_context = { moment, slugify: db.slugify };
    this.functions = { moment, slugify: db.slugify };
    this.plugins_cfg_context = {};
    this.keyFieldviews = {};
    this.external_tables = {};
    this.verifier = null;
    this.i18n = new I18n.I18n();
    this.i18n.configure({
      locales: [],
      directory: join(__dirname, "..", "app-locales"),
      mustacheConfig: { disable: true },
    });
    this.logLevel = 1;
    this.codeNPMmodules = {};
    this.npm_refresh_in_progess = false;
    this.hasJoinedLogSockets = false;
    try {
      this.scVersion = require("../../package.json").version;
    } catch (e) {
      this.scVersion = require("../package.json").version;
    }
    this.codepage_context = {};
    this.waitingWorkflows = true; //not sure so check
    this.keyframes = [
      "fadeIn",
      "fadeInLeft",
      "fadeInRight",
      "fadeInUp",
      "fadeInDown",
      "rollIn",
      "zoomIn",
      "zoomInUp",
      "bounce",
      "tada",
    ];
  }

  processSend(v: any) {
    process_send(v);
  }

  /**
   * Get Layout by user
   * Based on role of user
   * @param {object} user
   * @returns {object}
   */
  getLayout(user?: User) {
    if (user?.email && this.userLayouts[user.email]) {
      return this.userLayouts[user.email];
    } else {
      const role_id = user ? +user.role_id : 100;
      const layout_by_role = this.getConfig("layout_by_role");
      if (layout_by_role && layout_by_role[role_id]) {
        const chosen = this.layouts[layout_by_role[role_id]];
        if (chosen) return chosen;
      }
      const layoutvs = Object.values(this.layouts);
      return isNode()
        ? layoutvs[layoutvs.length - 1]
        : withRenderBody(layoutvs);
    }
  }

  getLayoutPlugin(user?: User) {
    if (user?._attributes?.layout) {
      const pluginName = user._attributes.layout.plugin;
      let plugin = this.plugins[pluginName];
      if (!plugin) plugin = this.plugins[this.plugin_module_names[pluginName]];
      if (plugin) return plugin;
      else
        this.log(
          5,
          `Warning: ${user.email} layout plugin ${pluginName} not found`
        );
    }
    const role_id = user ? +user.role_id : 100;
    const layout_by_role = this.getConfig("layout_by_role");
    if (layout_by_role && layout_by_role[role_id]) {
      const chosen = this.plugins[layout_by_role[role_id]];
      if (chosen) return chosen;
    }
    const layoutvs = Object.keys(this.layouts);
    const name = layoutvs[layoutvs.length - 1];
    return this.plugins[name];
  }

  // TODO auto is poorly supported
  getLightDarkMode(user?: User): "dark" | "light" | "auto" {
    if (user?._attributes?.layout?.config?.mode)
      return user?._attributes?.layout?.config?.mode;
    if (user?.attributes?.layout?.config?.mode)
      return user?.attributes?.layout?.config?.mode;
    if (this.plugin_cfgs) {
      const layout_name = this.getLayoutPlugin(user)?.plugin_name as string;
      if (user?._attributes?.[layout_name]?.mode)
        return user?._attributes[layout_name]?.mode;
      if (user?.attributes?.[layout_name]?.mode)
        return user?.attributes[layout_name]?.mode;
      const plugin_cfg = this.plugin_cfgs[layout_name];
      if (plugin_cfg?.mode) return plugin_cfg.mode;
    }
    return "light";
  }

  /**
   * Get Two factor authentication policy
   * Based on role of user
   * @param {object} user
   * @returns {string}
   */
  get2FApolicy(user: User) {
    const role_id = user ? +user.role_id : 100;
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
      if (this.hasJoinedLogSockets) this.emitLog(ten, min_level, msg);
    }
  }

  /**
   * Get all config variables list
   * If variable is not defined that default value is used
   * @function
   * @returns {Promise<object>}
   */
  async getAllConfigOrDefaults(): Promise<ConfigTypes> {
    let cfgs: ConfigTypes = {};
    const cfgInDB = await getAllConfig();
    if (cfgInDB)
      Object.entries(configTypes).forEach(
        ([key, v]: [key: string, v: SingleConfig]) => {
          const value =
            typeof cfgInDB[key] === "undefined" ? v.default : cfgInDB[key];
          if (!this.isFixedConfig(key)) cfgs[key] = { value, ...v };
        }
      );
    return cfgs;
  }

  /**
   * Returns true if key is defined in fixed_configuration for tenant
   * @param {string} key
   * @returns {boolean}
   */
  isFixedConfig(key: string): boolean {
    return (
      typeof db.connectObj.fixed_configuration[key] !== "undefined" ||
      (db.getTenantSchema() !== db.connectObj.default_schema &&
        (db.connectObj.inherit_configuration.includes(key) ||
          //TODO why do we need || "" - dont understand
          (singleton.getConfig("tenant_inherit_cfgs", "") || "")
            .split(",")
            .map((k: string) => k.trim())
            .includes(key)))
    );
  }
  /**
   * Refresh State cache for all Saltcorn main objects
   * @param noSignal - Do not signal - refresh to other cluster processes.
   * @param keepUnchanged - Some members don't need rebuilding if they did not change
   */
  async refresh(noSignal: boolean, keepUnchanged?: boolean) {
    await this.refresh_tables(noSignal);
    await this.refresh_views(noSignal);
    await this.refresh_triggers(noSignal);
    await this.refresh_pages(noSignal);
    await this.refresh_page_groups(noSignal);
    await this.refresh_config(noSignal);
    await this.refresh_npmpkgs(noSignal);
    await this.refresh_codepages(noSignal, keepUnchanged);
  }

  /**
   * Refresh config
   * @param {boolean} noSignal - Do not signal refresh to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_config(noSignal: boolean) {
    this.configs = await this.getAllConfigOrDefaults();
    this.getConfig("custom_events", []).forEach((cev: any) => {
      this.eventTypes[cev.name] = cev;
    });
    this.logLevel = +(this.configs.log_level.value || 1);
    if (!noSignal) this.log(5, "Refresh config");
    if (db.is_node) {
      // TODO ch mobile i18n
      await this.refresh_i18n();
      this.hasJoinedLogSockets =
        (this.configs.joined_log_socket_ids?.value || []).length > 0;
    }
    if (!noSignal && db.is_node)
      process_send({ refresh: "config", tenant: db.getTenantSchema() });
  }

  async refreshUserLayouts() {
    this.userLayouts = {};
    const usersWithLayout = (await User.find({})).filter(
      (user) => user._attributes?.layout
    );
    for (const user of usersWithLayout) {
      let pluginName = user._attributes.layout.plugin;
      let module = this.plugins[pluginName];
      if (!module) {
        pluginName = this.plugin_module_names[pluginName];
        module = this.plugins[pluginName];
      }
      const pluginCfg = this.plugin_cfgs[pluginName];
      if (module?.layout) {
        // @ts-ignore
        const userLayout = module.layout({
          ...pluginCfg,
          ...user._attributes.layout.config,
        });
        this.userLayouts[user.email] = userLayout;
      }
    }
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
      mustacheConfig: { disable: true },
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
    const Page = (await import("../models/page")).default;
    this.pages = await Page.find();
    if (!noSignal) this.log(5, "Refresh pages");

    if (!noSignal && db.is_node)
      process_send({ refresh: "pages", tenant: db.getTenantSchema() });
  }

  async refresh_page_groups(noSignal: boolean) {
    try {
      //sometimes this is run before migration
      const PageGroup = (await import("../models/page_group")).default;
      this.page_groups = await PageGroup.find();
      if (!noSignal) this.log(5, "Refresh page groups");
    } catch (e) {
      console.error("error initializing page groups", e);
    }
    if (!noSignal && db.is_node)
      process_send({ refresh: "page_groups", tenant: db.getTenantSchema() });
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
    this.fields = await db.select(
      "_sc_fields",
      {},
      { orderBy: "name", nocase: true }
    );
    const allConstraints = await db.select("_sc_table_constraints", {});
    const Model = require("../models/model");
    let allModels = [];
    try {
      //needed for refresh in pre-model migration
      allModels = await Model.find({});
    } catch (e) {}
    for (const table of allTables) {
      if (table.provider_name) {
        table.provider_cfg = stringToJSON(table.provider_cfg);
        const provider = this.table_providers[table.provider_name];
        if (!provider) table.fields = [];
        else {
          if (typeof provider.fields === "function")
            table.fields = await provider.fields(table.provider_cfg);
          else table.fields = provider.fields;
          table.fields.forEach((f: any) => (f.table_id = table.id));
          this.fields.push(...table.fields);
        }
        continue;
      }
      table.fields = this.fields.filter((f: Field) => f.table_id === table.id);
      table.constraints = allConstraints
        .filter((f: any) => f.table_id === table.id)
        .map((c: any) => new TableConstraint(c));
      table.fields.forEach((f: Field) => {
        if (db.isSQLite && typeof f.attributes === "string")
          f.attributes = JSON.parse(f.attributes);
        if (
          f.attributes &&
          f.attributes.localizes_field &&
          f.attributes.locale
        ) {
          const localized = table.fields.find(
            (lf: Field) => lf.name === f.attributes.localizes_field
          );
          if (localized) {
            if (db.isSQLite && typeof localized.attributes === "string")
              localized.attributes = JSON.parse(localized.attributes);
            if (!localized.attributes) localized.attributes = {};

            if (!localized.attributes.localized_by)
              localized.attributes.localized_by = {};

            localized.attributes.localized_by[f.attributes.locale] = f.name;
          }
        }
      });
      const models = allModels.filter((m: any) => m.table_id == table.id);
      for (const model of models) {
        const predictor_function = model.predictor_function;
        this.functions[model.name] = { isAsync: true, run: predictor_function };
        this.function_context[model.name] = predictor_function;
      }
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

  get utcOffset() {
    const tzName = this.getConfig("timezone");
    if (!tzName) return 0;
    return tz(tzName).utcOffset() / 60;
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
   * @param key - key of parameter
   * @param value - value of parameter
   */
  async setConfig(key: string, value: any) {
    if (
      !this.configs[key] ||
      typeof this.configs[key].value === "undefined" ||
      this.configs[key].value !== value
    ) {
      const fn = async () => {
        await setConfig(key, value);
        this.configs[key] = { value };
        if (key.startsWith("localizer_")) await this.refresh_i18n();
        if (key === "log_level") this.logLevel = +value;
        if (key === "joined_log_socket_ids")
          this.hasJoinedLogSockets = (value || []).length > 0;
        if (db.is_node)
          process_send({ refresh: "config", tenant: db.getTenantSchema() });
        else {
          await this.refresh_config(true);
        }
      };
      if (db.getTenantSchema() !== this.tenant)
        await db.runWithTenant(this.tenant, fn);
      else await fn();
    }
  }

  /**
   * Delete config parameter by key
   * @param keys - key of parameter
   */
  async deleteConfig(...keys: string[]) {
    const fn = async () => {
      for (const key of keys) {
        await deleteConfig(key);
        delete this.configs[key];
      }
      if (db.is_node)
        process_send({ refresh: "config", tenant: db.getTenantSchema() });
      else {
        await this.refresh_config(true);
      }
    };
    if (db.getTenantSchema() !== this.tenant)
      await db.runWithTenant(this.tenant, fn);
    else await fn();
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
    this.log(6, `Register Plugin: ${name} at ${location}`);
    this.plugins[name] = plugin;
    this.plugin_cfgs[name] = cfg;
    if (plugin.exposed_configs && cfg) {
      const exposedCfgs: any = {};
      for (const exposed of plugin.exposed_configs) {
        exposedCfgs[exposed] = cfg[exposed];
      }
      this.plugins_cfg_context[name] = exposedCfgs;
    }
    if (location) this.plugin_locations[plugin.plugin_name || name] = location;
    this.headers[name] = [];
    if (modname) this.plugin_module_names[modname] = name;

    let hasFunctions = false;
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
        hasFunctions = true;
        this.functions[k] = v;
        this.function_context[k] = typeof v === "function" ? v : v.run;
      }
    );
    Object.entries(withCfg("modelpatterns", {})).forEach(
      ([k, v]: [k: string, v: any]) => {
        this.modelpatterns[k] = v;
      }
    );
    Object.entries(withCfg("fileviews", {})).forEach(([k, v]) => {
      this.fileviews[k] = v as FieldView;
    });
    Object.entries(withCfg("actions", {})).forEach(([k, v]) => {
      this.actions[k] = v as Action;
    });
    Object.entries(withCfg("eventTypes", {})).forEach(([k, v]) => {
      this.eventTypes[k] = v as { hasChannel: boolean };
    });
    Object.entries(withCfg("fonts", {})).forEach(([k, v]) => {
      this.fonts[k] = v as string;
    });
    withCfg("icons", []).forEach((icon: string) => {
      this.icons.push(icon);
    });
    Object.entries(withCfg("table_providers", {})).forEach(([k, v]) => {
      this.table_providers[k] = v as TableProvider;
    });
    Object.entries(withCfg("authentication", {})).forEach(([k, v]) => {
      this.auth_methods[k] = v as AuthenticationMethod;
    });
    Object.entries(withCfg("copilot_skills", {})).forEach(([k, v]) => {
      this.copilot_skills[k] = v as CopilotSkill;
    });
    Object.entries(withCfg("external_tables", {})).forEach(
      ([k, v]: [k: string, v: any]) => {
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
    const routes = withCfg("routes", []);
    this.plugin_routes[name] = routes;
    if (routes.length > 0 && this.routesChangedCb) this.routesChangedCb();
    if (hasFunctions)
      this.refresh_codepages(true).catch((e) => console.error(e));
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

  get eval_context() {
    return { ...this.function_context, ...this.codepage_context };
  }

  /**
   * Take the config 'function_code_pages' and build the 'codepage_context' member
   * @param noSignal - Do not signal reload to other cluster processes.
   * @param keepUnchanged - When 'function_code_pages' didn't change, true skips building it again
   */
  async refresh_codepages(noSignal?: boolean, keepUnchanged?: boolean) {
    const code_pages: Record<string, string> = this.getConfig(
      "function_code_pages",
      {}
    );
    if (keepUnchanged && flatEqual(code_pages, this.oldCodePages)) return;
    this.codepage_context = {};
    let errMsg;
    if (Object.keys(code_pages).length > 0) {
      const fetch = require("node-fetch");
      try {
        const myContext = {
          ...this.function_context,
          Table,
          File,
          User,
          setTimeout,
          fetch,
          sleep,
          interpolate,
          URL,
          console, //TODO consoleInterceptor
          require: (nm: string) => this.codeNPMmodules[nm],
        };
        const funCtxKeys = new Set(Object.keys(myContext));
        const sandbox = createContext(myContext);
        const codeStr = Object.values(code_pages).join(";\n");
        runInContext(codeStr, sandbox);

        Object.keys(sandbox).forEach((k) => {
          if (!funCtxKeys.has(k)) {
            this.codepage_context[k] = sandbox[k];
          }
        });
      } catch (e: any) {
        console.error("code page load error: ", e);
        errMsg = e?.message || e;
      }
    }
    if (!noSignal && db.is_node)
      process_send({ refresh: "codepages", tenant: db.getTenantSchema() });
    this.oldCodePages = code_pages;
    return errMsg;
  }

  /**
   * Reload plugins
   * @param {boolean} noSignal - Do not signal reload to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_plugins(noSignal?: boolean) {
    this.viewtemplates = {};
    this.modelpatterns = {};
    this.types = {};
    this.stashed_fieldviews = {};
    this.fields = [];
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.copilot_skills = {};
    this.layouts = { emergency: emergency_layout };
    this.headers = {};
    this.function_context = { moment, slugify: db.slugify };
    this.functions = { moment, slugify: db.slugify };
    this.keyFieldviews = {};
    this.external_tables = {};
    this.eventTypes = {};
    this.verifier = null;
    this.fonts = standard_fonts;
    this.icons = get_standard_icons();

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

  setLogEmitter(f: Function) {
    globalLogEmitter = f;
  }

  emitLog(ten: string, min_level: number, msg: string) {
    globalLogEmitter(ten, min_level, msg);
  }

  get pg_ts_config(): string {
    const lang_dict: any = {
      en: "english",
      de: "german",
      da: "danish",
      fr: "french",
      es: "spanish",
      ar: "arabic",
      it: "italian",
      nl: "dutch",
      no: "norwegian",
      pt: "portuguese",
      ru: "russian",
      sv: "swedish",
      //no pl, si, uk, zh in postgres
    };
    return lang_dict[this.getConfig("default_locale", "en")] || "simple";
  }
  async refresh_npmpkgs(noSignal?: boolean) {
    if (this.npm_refresh_in_progess) return;
    this.npm_refresh_in_progess = true;
    const moduleStr: string = this.getConfigCopy("npm_available_js_code", "");
    if (!moduleStr) return;
    const moduleNames = moduleStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s);
    if (moduleNames.length === 0) return;
    if (!this.pluginManager) this.pluginManager = new PluginManager();
    for (const moduleNameWithVersion of moduleNames) {
      const [moduleName, version] = moduleNameWithVersion.split("==");
      if (!this.codeNPMmodules[moduleName]) {
        try {
          if (
            [
              "fs",
              "child_process",
              "path",
              "http",
              "https",
              "crypto",
              "dns",
              "os",
              "process",
              "net",
              "querystring",
              "stream",
              "url",
              "zlib",
            ].includes(moduleName)
          ) {
            if (process.env.IGNORE_DYNAMIC_REQUIRE !== "true") {
              this.codeNPMmodules[moduleName] = require(moduleName);
            }
          } else {
            const defaultVersion: any = {
              cheerio: "1.0.0-rc.12",
            };
            await this.pluginManager.install(
              moduleName,
              version || defaultVersion[moduleName]
            );

            this.codeNPMmodules[moduleName] =
              this.pluginManager.require(moduleName);
          }
        } catch (e) {
          console.error("npm install error module", moduleName, e);
        }
      }
    }
    if (!noSignal && db.is_node)
      process_send({ refresh: "npmpkgs", tenant: db.getTenantSchema() });
    this.npm_refresh_in_progess = false;
  }
}

/**
 * Global
 */
let globalRoomEmitter: Function = () => {};
let globalLogEmitter: Function = () => {};

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
  if (ten === "public") return singleton;
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
  if (singleton?.configs?.base_url?.value) {
    const cfg_domain = get_domain(singleton?.configs?.base_url.value);
    otherdomaintenants[cfg_domain] = "public";
  }

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
    } catch (err: any) {
      console.error(`init_multi_tenant error in domain ${domain}: `, err.stack);
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
  public_user_role: 100,
  get_view_goto: true,
  table_undo: true,
  ellipsize: true,
  aggregation_query: true,
  list_builder: true,
  esm_plugins: true,
  stringify_json_fields: true,
  dynamic_auth_parameters: true,
  capacitor: true,
  workflows: true,
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
