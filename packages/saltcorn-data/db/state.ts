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
  CapacitorPlugin,
} from "@saltcorn/types/base_types";
import { GenObj, Type } from "@saltcorn/types/common_types";
import type { ConfigTypes, SingleConfig } from "../models/config";
import type Model from "../models/model";
import User from "../models/user";
const { PluginManager } = require("live-plugin-manager");

import moment from "moment";

import db from ".";
import { migrate } from "../migrate"; // Shows the true args and return type
// const { migrate } = require("../migrate"); // Shows the args and return type as 'any'
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
import { AbstractRole } from "@saltcorn/types/model-abstracts/abstract_role";
import MetaData from "../models/metadata";
import { PushMessageHelper } from "../models/internal/push_message_helper";

/**
 * @param v
 */
const process_send = (v: any) => {
  if (!process.send) console.log("warning: there is no process send");

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
  iconSet: Set<string>;
  layouts: Record<string, PluginLayout>;
  userLayouts: Record<string, PluginLayout & { config: GenObj }>;
  headers: Record<string, Array<Header>>;
  assets_by_role: Record<string, Array<Header>>;
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
  hasJoinedDynamicUpdateSockets: boolean;
  hasJoinedCollabSockets: boolean;
  queriesCache?: Record<string, any>;
  scVersion: string;
  waitingWorkflows?: boolean;
  keyframes: Array<string>;
  copilot_skills: Array<CopilotSkill>;
  capacitorPlugins: Array<CapacitorPlugin>;
  exchange: Record<string, Array<unknown>>;
  sendMessageToWorkers?: Function;
  mobile_push_handler: Record<string, Function>;
  pushHelper?: PushMessageHelper;

  private oldCodePages: Record<string, string> | undefined;

  /**
   * State constructor
   * @param {string} tenant description
   */
  constructor(tenant: string) {
    const { today } = require("../models/expression");

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
    this.copilot_skills = [];
    this.eventTypes = {};
    this.fonts = standard_fonts;
    this.iconSet = new Set(get_standard_icons());
    this.layouts = { emergency: emergency_layout };
    this.userLayouts = {};
    this.headers = {};
    this.assets_by_role = {};
    this.function_context = { moment, today, slugify: db.slugify };
    this.functions = { moment, today, slugify: db.slugify };
    this.plugins_cfg_context = {};
    this.keyFieldviews = {};
    this.external_tables = {};
    this.exchange = {};
    this.verifier = null;
    this.i18n = new I18n.I18n();
    this.i18n.configure({
      locales: [],
      staticCatalog: {},
      mustacheConfig: { disable: true },
    });
    this.logLevel = 1;
    this.codeNPMmodules = {};
    this.npm_refresh_in_progess = false;
    this.hasJoinedLogSockets = false;
    this.hasJoinedDynamicUpdateSockets = false;
    this.hasJoinedCollabSockets = false;
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
    this.capacitorPlugins = [];
    this.mobile_push_handler = {};
  }

  async computeAssetsByRole() {
    this.assets_by_role = {};
    let roleIds: number[] = [];
    const Role = (await import("../models/role")).default;
    const roles = await Role.find({}, { orderBy: "id" });
    roleIds = roles.map((r) => +r.id).filter((n: number) => !Number.isNaN(n));

    if (!roleIds.includes(100)) roleIds.push(100);
    for (const rid of roleIds) this.assets_by_role[rid] = [];

    const allHeaders = Object.values(this.headers).flat();
    for (const h of allHeaders) {
      if (!h.onlyViews && !h.onlyFieldviews) {
        for (const rid of roleIds) this.assets_by_role[rid].push(h);
        continue;
      }

      const onlyViews = h.onlyViews
        ? Array.isArray(h.onlyViews)
          ? h.onlyViews
          : [h.onlyViews]
        : [];

      const onlyFieldviews = h.onlyFieldviews
        ? Array.isArray(h.onlyFieldviews)
          ? h.onlyFieldviews
          : [h.onlyFieldviews]
        : [];

      const matchedViews = this.views.filter((v) => {
        if (onlyViews.length) {
          const tmplName = v.viewtemplateObj?.name || v.viewtemplate;
          if (
            onlyViews.includes(tmplName) ||
            onlyViews.includes(v.viewtemplate)
          )
            return true;
        }
        if (onlyFieldviews.length) {
          const columns = Array.isArray(v.configuration?.columns)
            ? v.configuration!.columns
            : [];
          const colFieldviews = columns
            .map(
              (col: {
                type: string; // "Field" | "Action"
                field_name: string;
                fieldview: string;
                configuration: any;
              }) => (col?.type === "Field" ? col.fieldview : null)
            )
            .filter((fv: string) => !!fv);
          if (colFieldviews.some((fv: string) => onlyFieldviews.includes(fv)))
            return true;
        }
        return false;
      });

      for (const v of matchedViews) {
        const min_role = +(v.min_role ?? 100);
        for (const rid of roleIds) {
          if (rid <= min_role) this.assets_by_role[rid].push(h);
        }
      }
    }

    for (const ridStr of Object.keys(this.assets_by_role)) {
      const rid = +ridStr;
      this.assets_by_role[rid] = Array.from(new Set(this.assets_by_role[rid]));
    }
  }

  processSend(v: any) {
    if (!process.send) {
      if (this.sendMessageToWorkers) this.sendMessageToWorkers(v);
      else if (singleton.sendMessageToWorkers)
        singleton.sendMessageToWorkers(v);
      //else console.warn("nowhere to send msg", v);
    } else process_send(v);
  }

  /**
   * Get Layout by user
   * Based on role of user
   * @param {object} user
   * @returns {object}
   */
  getLayout(user?: User): PluginLayout & { config: GenObj } {
    // first, try if role set
    const role_id = user ? +user.role_id : 100;
    const layout_by_role = this.getConfig("layout_by_role");
    if (layout_by_role && layout_by_role[role_id]) {
      const pluginName = layout_by_role[role_id];
      const chosen = this.layouts[layout_by_role[role_id]];

      if (chosen) {
        if (
          user?.email &&
          this.userLayouts[user.email] &&
          this.userLayouts[user.email].pluginName === pluginName
        )
          return this.userLayouts[user.email];
        return {
          ...chosen,
          pluginName,
          config: this.plugin_cfgs[layout_by_role[role_id]],
        };
      }
    }

    //if there is a user layout
    if (user?.email && this.userLayouts[user.email])
      return this.userLayouts[user.email];

    const withRenderBody = (
      layouts: [string, PluginLayout][]
    ): PluginLayout & { config: GenObj } => {
      for (let i = layouts.length - 1; i >= 0; i--)
        if (layouts[i][1].renderBody)
          return {
            ...layouts[i][1],
            config: this.plugin_cfgs[layouts[i][0]],
          };
      throw new Error("No layout with renderBody found");
    };

    //last installed
    const layoutvs = Object.entries(this.layouts);
    const layout = isNode()
      ? {
          ...layoutvs[layoutvs.length - 1][1],
          config: this.plugin_cfgs[layoutvs[layoutvs.length - 1][0]],
        }
      : withRenderBody(layoutvs);
    return layout;
  }

  getLayoutPlugin(user?: User): Plugin {
    //try this for consistency
    const { pluginName } = this.getLayout(user);
    if (pluginName) {
      let plugin = this.plugins[pluginName];
      if (!plugin) plugin = this.plugins[this.plugin_module_names[pluginName]];
      if (plugin) return plugin;
    }

    // legacy follows TODO we probably dont need this
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
    const { config } = this.getLayout(user);
    if (config?.mode) return config.mode;

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
  isFixedPluginConfig(plugin_name: string, key: string): boolean {
    return (
      typeof db.connectObj.fixed_plugin_configuration?.[plugin_name]?.[key] !==
      "undefined"
    );
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
      await this.refresh_i18n();
      await this.refresh_push_helper();
    }
    if (!noSignal && db.is_node)
      this.processSend({ refresh: "config", tenant: db.getTenantSchema() });
  }

  /**
   * Set a config value that will not persist into the db
   * @param key config key
   * @param value config val
   */
  refresh_ephemeral_config(key: string, value: any) {
    this.configs[key] = { value };
    this.hasJoinedLogSockets =
      (this.configs.joined_log_socket_ids?.value || []).length > 0;
    this.hasJoinedDynamicUpdateSockets =
      (this.configs.joined_dynamic_update_socket_ids?.value || []).length > 0;
    this.hasJoinedCollabSockets =
      (this.configs.joined_real_time_socket_ids?.value || []).length > 0;
  }

  //legacy
  async refreshUserLayouts() {
    await this.refresh_userlayouts(false);
  }
  async refresh_userlayouts(noSignal: boolean) {
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
        this.userLayouts[user.email] = {
          ...userLayout,
          pluginName,
          config: { ...pluginCfg, ...user._attributes.layout.config },
        };
      }
    }
    if (!noSignal && db.is_node)
      this.processSend({
        refresh: "userlayouts",
        tenant: db.getTenantSchema(),
      });
  }

  /**
   * Refresh i18n Internationalization
   * @returns {Promise<void>}
   */
  async refresh_i18n() {
    const staticCatalog: Record<string, Record<string, string>> = {};

    const allStrings = this.getConfig("localizer_strings", {});
    for (const lang of Object.keys(this.getConfig("localizer_languages", {}))) {
      staticCatalog[lang] = allStrings[lang] || {};
    }
    this.log(5, "Refresh i18n");

    this.i18n = new I18n.I18n();
    this.i18n.configure({
      locales: Object.keys(this.getConfig("localizer_languages", {})),
      staticCatalog,
      mustacheConfig: { disable: true },
      defaultLocale: this.getConfig("default_locale"),
    });
  }

  async refresh_push_helper() {
    try {
      const pushConfig: any = {
        icon: this.getConfig("push_notification_icon"),
        badge: this.getConfig("push_notification_badge"),
        vapidPublicKey: this.getConfig("vapid_public_key"),
        vapidPrivateKey: this.getConfig("vapid_private_key"),
        vapidEmail: this.getConfig("vapid_email"),
        firebase: {
          jsonPath: this.getConfig("firebase_json_key"),
          jsonContent: null,
        },
        notificationSubs: this.getConfig("push_notification_subscriptions", {}),
        syncSubs: this.getConfig("push_sync_subscriptions", {}),
      };

      if (!this.pushHelper) {
        const fireBaseFile =
          typeof pushConfig.firebase.jsonPath === "string" &&
          pushConfig.firebase.jsonPath.length > 0
            ? await File.findOne(pushConfig.firebase.jsonPath)
            : null;
        if (fireBaseFile)
          pushConfig.firebase.jsonContent = require(fireBaseFile?.absolutePath);
        this.pushHelper = new PushMessageHelper(pushConfig);
      } else {
        if (pushConfig.firebase.jsonPath !== this.pushHelper.firebaseJsonPath) {
          const fireBaseFile = await File.findOne(pushConfig.firebase.jsonPath);
          if (fireBaseFile)
            pushConfig.firebase.jsonContent = require(
              fireBaseFile?.absolutePath
            );
        }
        this.pushHelper.updateConfig(pushConfig);
      }
    } catch (error) {
      console.error("Error initializing push helper", error);
    }
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
    // rebuild assets_by_role whenever views change
    try {
      await this.computeAssetsByRole();
    } catch (error) {
      console.error("Error computing assets by role", error);
    }
    if (!noSignal) this.log(5, "Refresh views");

    if (!noSignal && db.is_node)
      this.processSend({ refresh: "views", tenant: db.getTenantSchema() });
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
      this.processSend({ refresh: "triggers", tenant: db.getTenantSchema() });
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
      this.processSend({ refresh: "pages", tenant: db.getTenantSchema() });
  }

  async refresh_page_groups(noSignal: boolean) {
    await db.tryCatchInTransaction(
      async () => {
        //sometimes this is run before migration
        const PageGroup = (await import("../models/page_group")).default;
        this.page_groups = await PageGroup.find();
        if (!noSignal) this.log(5, "Refresh page groups");
      },
      (e: Error) => {
        console.error("error initializing page groups", e);
      }
    );
    if (!noSignal && db.is_node)
      this.processSend({
        refresh: "page_groups",
        tenant: db.getTenantSchema(),
      });
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
    let allModels: Model[] = [];
    await db.tryCatchInTransaction(
      async () => {
        //needed for refresh in pre-model migration
        allModels = await Model.find({});
      },
      (e: Error) => {}
    );
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
      table.fields.forEach((f: GenObj) => {
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
        if (f.type === "Key") {
          const reftable = allTables.find(
            (t: GenObj) => t.name === f.reftable_name
          );
          if (reftable) {
            const refPK = (reftable.fields || []).find(
              (f: GenObj) => f.primary_key
            );
            if (refPK) f.reftype = refPK.type?.name || refPK.type;
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
      this.processSend({ refresh: "tables", tenant: db.getTenantSchema() });
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
    const exposed = db.connectObj.exposed_configuration[key];
    if (typeof exposed !== "undefined") return exposed;
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
        const isEphemeral = !!configTypes[key]?.ephemeral;
        if (!isEphemeral) await setConfig(key, value);
        this.configs[key] = { value };
        if (key.startsWith("localizer_")) await this.refresh_i18n();
        if (key === "log_level") this.logLevel = +value;
        if (key === "joined_log_socket_ids")
          this.hasJoinedLogSockets = (value || []).length > 0;
        if (key === "joined_dynamic_update_socket_ids")
          this.hasJoinedDynamicUpdateSockets = (value || []).length > 0;
        if (key === "joined_real_time_socket_ids")
          this.hasJoinedCollabSockets = (value || []).length > 0;
        if (db.is_node) {
          if (isEphemeral) {
            // config does not persist, send the whole object
            this.processSend({
              refresh: "ephemeral_config",
              tenant: db.getTenantSchema(),
              key,
              value,
            });
          } else {
            // config does persist, just send the key
            this.processSend({
              refresh: "config",
              tenant: db.getTenantSchema(),
            });
          }
        } else {
          // mobile
          if (isEphemeral) this.refresh_ephemeral_config(key, value);
          else await this.refresh_config(true);
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
        this.processSend({ refresh: "config", tenant: db.getTenantSchema() });
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
    setCfg?: SingleConfig,
    location?: string,
    modname?: string
  ) {
    this.log(6, `Register Plugin: ${name} at ${location}`);
    this.plugins[name] = plugin;
    const cfg = {
      ...setCfg,
      ...(db.connectObj.fixed_plugin_configuration?.[name] || {}),
    };
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
      this.iconSet.add(icon);
    });
    Object.entries(withCfg("table_providers", {})).forEach(([k, v]) => {
      this.table_providers[k] = v as TableProvider;
    });
    Object.entries(withCfg("authentication", {})).forEach(([k, v]) => {
      this.auth_methods[k] = v as AuthenticationMethod;
    });
    Object.entries(withCfg("exchange", {})).forEach(([k, v]) => {
      if (!this.exchange[k]) this.exchange[k] = [];
      this.exchange[k].push(...(v as Array<unknown>));
    });
    withCfg("copilot_skills", []).forEach((v: CopilotSkill) => {
      if (
        v?.function_name &&
        !this.copilot_skills
          .map((s) => s.function_name)
          .includes(v?.function_name)
      )
        this.copilot_skills.push(v);
    });

    Object.entries(withCfg("external_tables", {})).forEach(
      ([k, v]: [k: string, v: any]) => {
        if (!v.name) v.name = k;
        this.external_tables[k] = v;
      }
    );
    Object.entries(withCfg("fieldviews", {})).forEach(
      ([nm, fv]: [nm: string, fv: any]) => {
        const process_fv = (k: string, v: FieldView) => {
          if (!v.type) return;
          if (Array.isArray(v.type)) {
            v.type.forEach((t) => {
              process_fv(k, { ...v, type: t });
            });
            return;
          }

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
        };
        process_fv(nm, fv);
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

    const existingScripts = new Set(
      Object.values(this.headers)
        .flat(1)
        .map((h) => h.script)
        .filter(Boolean)
    );
    withCfg("headers", []).forEach((h: any) => {
      if (
        !this.headers[name].includes(h) &&
        !(h.script && existingScripts.has(h.script))
      )
        this.headers[name].push(h);
    });
    const routes = withCfg("routes", []);
    this.plugin_routes[name] = routes;
    if (routes.length > 0 && this.routesChangedCb) this.routesChangedCb();

    withCfg("capacitor_plugins", []).forEach((capPlugin: CapacitorPlugin) => {
      if (this.capacitorPlugins.find((cp) => cp.name === capPlugin.name))
        this.log(5, `Capacitor plugin ${capPlugin.name} already registered`);
      else this.capacitorPlugins.push(capPlugin);
    });

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
      this.processSend({ removePlugin: name, tenant: db.getTenantSchema() });
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
      const Page = (await import("../models/page")).default;
      try {
        const myContext = {
          ...this.function_context,
          Table,
          File,
          View,
          User,
          Page,
          Field,
          Trigger,
          MetaData,
          setTimeout,
          fetch,
          sleep,
          interpolate,
          tryCatchInTransaction: db.tryCatchInTransaction,
          commitAndBeginNewTransaction: db.commitAndBeginNewTransaction,
          emit_to_client: (data: any, userIds: number[]) => {
            const enabled = this.getConfig("enable_dynamic_updates", true);
            if (!enabled) {
              this.log(
                5,
                "emit_to_client called, but dynamic updates are disabled"
              );
              return;
            }
            const safeIds = Array.isArray(userIds)
              ? userIds
              : userIds
                ? [userIds]
                : [];
            this.emitDynamicUpdate(db.getTenantSchema(), data, safeIds);
          },
          Buffer: isNode() ? Buffer : require("buffer"),
          URL,
          console, //TODO consoleInterceptor
          require: (nm: string) => this.codeNPMmodules[nm],
          setConfig: (k: string, v: any) =>
            this.isFixedConfig(k) ? undefined : this.setConfig(k, v),
          getConfig: (k: string) =>
            this.isFixedConfig(k) ? undefined : this.getConfig(k),
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
      this.processSend({ refresh: "codepages", tenant: db.getTenantSchema() });
    this.oldCodePages = code_pages;
    return errMsg;
  }

  /**
   * Reload plugins
   * @param {boolean} noSignal - Do not signal reload to other cluster processes.
   * @returns {Promise<void>}
   */
  async refresh_plugins(noSignal?: boolean) {
    const { today } = require("../models/expression");

    this.viewtemplates = {};
    this.modelpatterns = {};
    this.types = {};
    this.stashed_fieldviews = {};
    this.fields = [];
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.copilot_skills = [];
    this.layouts = { emergency: emergency_layout };
    this.headers = {};
    this.function_context = { moment, today, slugify: db.slugify };
    this.functions = { moment, today, slugify: db.slugify };
    this.keyFieldviews = {};
    this.external_tables = {};
    this.eventTypes = {};
    this.exchange = {};
    this.verifier = null;
    this.fonts = standard_fonts;
    this.iconSet = new Set(get_standard_icons());

    Object.entries(this.plugins).forEach(([k, v]: [k: string, v: Plugin]) => {
      this.registerPlugin(k, v, this.plugin_cfgs[k]);
    });
    await this.refresh(true);
    if (!noSignal && db.is_node)
      this.processSend({ refresh: "plugins", tenant: db.getTenantSchema() });
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
    strings.push(this.getConfig("site_name"));
    for (const table of this.tables)
      for (const field of table.fields) {
        strings.push(field.label);
        if (
          ((typeof field.type !== "string" && field.type?.name === "String") ||
            field.type === "String") &&
          field.attributes?.options
        )
          strings.push(
            ...field.attributes.options.split(",").map((s: string) => s.trim())
          );
      }

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

  /**
   * @param f Function to emit collaborative editing messages
   */
  setCollabEmitter(f: Function) {
    globalCollabEmitter = f;
  }

  /**
   * @param f Function to emit dynamic update messages triggered from run_js_code actions
   */
  setDynamicUpdateEmitter(f: Function) {
    globalDynamicUpdateEmitter = f;
  }

  emitLog(ten: string, min_level: number, msg: string) {
    globalLogEmitter(ten, min_level, msg);
  }

  /**
   * For collaborative editing
   * @param ten
   * @param type
   * @param data
   */
  emitCollabMessage(ten: string, type: string, data: any) {
    if (!this.hasJoinedCollabSockets) {
      this.log(5, "emitCollabMessage called, but no clients are joined yet");
      return;
    }
    globalCollabEmitter(ten, type, data);
  }

  /**
   * For dynamic updates triggered from a run_js_code action
   * @param ten
   * @param data
   * @param userIds - optional array of user IDs to send the update to
   */
  emitDynamicUpdate(ten: string, data: any, userIds?: number[]) {
    if (!this.hasJoinedDynamicUpdateSockets) {
      this.log(5, "emitDynamicUpdate called, but no clients are joined yet");
      return;
    }
    globalDynamicUpdateEmitter(ten, data, userIds);
  }

  get icons() {
    return [...this.iconSet];
  }

  // default auth methods to enabled
  get_auth_enabled_by_role(role_id: number): Record<string, boolean> {
    const auth_method_by_role = this.getConfig("auth_method_by_role", {});
    const auth_methods = Object.keys(this.auth_methods);
    auth_methods.unshift("Password");

    const enabled: Record<string, boolean> = {};
    if (!auth_method_by_role[role_id]) {
      for (const auth_method of auth_methods) enabled[auth_method] = true;
    } else {
      for (const auth_method of auth_methods) {
        const setVal = auth_method_by_role[role_id][auth_method];
        enabled[auth_method] = typeof setVal === "undefined" ? true : setVal;
      }
    }
    return enabled;
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
              "v8",
              "http2",
              "path",
              "tls",
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
      this.processSend({ refresh: "npmpkgs", tenant: db.getTenantSchema() });
    this.npm_refresh_in_progess = false;
  }
}

/**
 * Global
 */
let globalRoomEmitter: Function = () => {};
let globalLogEmitter: Function = () => {};
let globalCollabEmitter: Function = () => {};
let globalDynamicUpdateEmitter: Function = () => {};

// the root tenant's state is singleton
const singleton = new State(db.connectObj.default_schema || "public");

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
const tenants: Record<string, State> = {
  [db.connectObj.default_schema || "public"]: singleton,
};
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
  if (ten === "public" || ten === db.connectObj.default_schema)
    return singleton;
  return tenants[ten];
};

//For user supplied strings
const getApp__ = (): ((s: string) => string) => {
  const ctx = db.getRequestContext();
  const locale = ctx?.req?.getLocale();
  if (locale) {
    const state = getState();
    if (state) return (s) => state.i18n.__({ phrase: s, locale }) || s;
  }
  return (s: string) => s;
};

//For builtin strings
const getReq__ = (): ((s: string) => string) => {
  const ctx = db.getRequestContext();
  return ctx?.req?.__ || ((s: string) => s);
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
  plugin_loader: (s: string) => Promise<void>,
  disableMigrate: boolean,
  tenantList: string[],
  setupMultiNodeListener: Function
): Promise<void> => {
  // for each domain
  if (singleton?.configs?.base_url?.value) {
    const cfg_domain = get_domain(singleton?.configs?.base_url.value);
    otherdomaintenants[cfg_domain] = db.connectObj.default_schema || "public";
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
      if (setupMultiNodeListener) {
        // listen on node updates channel for this tenant
        await db.runWithTenant(domain, async () =>
          setupMultiNodeListener(await db.getClient())
        );
      }
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
 * State Features - Help modules figure out what features are available in core saltcorn.
 * This is necessary because modules need to work on different versions of core saltcorn
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
  capacitor_version: 7,
  workflows: true,
  metadata: true,
  multitype_fieldviews: true,
  nested_fieldrepeats: true,
  api_view_route: true,
  file_fieldviews_cfg_workflows: true,
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
  getApp__,
  getReq__,
};
