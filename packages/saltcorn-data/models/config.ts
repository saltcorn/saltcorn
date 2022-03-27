/**
 * Config Variables
 * @category saltcorn-data
 * @module models/config
 * @subcategory models
 */
import db from "../db";
import latestVersion from "latest-version";
const { getConfigFile, configFilePath } = require("../db/connect");

import { writeFileSync } from "fs";
import { tz } from "moment-timezone";
const allTimezones = tz.names();
const defaultTimezone = tz.guess();

type SingleConfig = { [key: string]: any };
type ConfigTypes = { [key: string]: SingleConfig };

/**
 * Config variables types
 * @namespace
 * @category saltcorn-data
 */
const configTypes: ConfigTypes = {
  /** @type {object} */
  site_name: {
    type: "String",
    label: "Site name",
    default: "Saltcorn",
    blurb: "A short string which is the name of your site",
  },
  /** @type {object} */
  timezone: {
    type: "String",
    label: "Home Timezone",
    default: defaultTimezone,
    attributes: {
      options: allTimezones,
    },
  },
  /** @type {object} */
  site_logo_id: {
    type: "File",
    label: "Site logo",
    default: 0,
    attributes: {
      select_file_where: { min_role_read: 10, mime_super: "image" },
    },
    blurb: "Select a publicly accessible image file for the menu logo",
  },
  /** @type {object} */
  favicon_id: {
    type: "File",
    label: "Favicon",
    default: 0,
    attributes: {
      select_file_where: { min_role_read: 10, mime_super: "image" },
    },
    blurb: "Select a publicly accessible image file for the browser tab icon",
  },
  /** @type {object} */
  base_url: {
    type: "String",
    label: "Base URL",
    default: "",
    onChange(val: string) {
      const tenant = db.getTenantSchema();
      const isRoot = tenant === db.connectObj.default_schema;
      if (!isRoot && val) {
        const { set_tenant_base_url } = require("../db/state");
        set_tenant_base_url(tenant, val);
      }
    },
    blurb:
      "The URL at which your site is available. For instance, https://example.com/",
  },
  /** @type {object} */
  menu_items: { type: "hidden", label: "Menu items" },
  /** @type {object} */
  unrolled_menu_items: { type: "hidden", label: "Menu items" },

  /** @type {object} */
  globalSearch: { type: "hidden", label: "Global search" },
  /** @type {object} */
  available_packs: { type: "hidden", label: "Available packs" },
  /** @type {object} */
  available_packs_fetched_at: {
    type: "Date",
    label: "Available packs fetched",
  },
  /** @type {object} */
  available_plugins: { type: "hidden", label: "Available plugins" },
  /** @type {object} */
  available_plugins_fetched_at: {
    type: "Date",
    label: "Available plugins fetched",
  },
  /** @type {object} */
  home_page_by_role: { type: "hidden", label: "Home Page by Role" },
  /** @type {object} */
  exttables_min_role_read: {
    type: "hidden",
    label: "Home Page by Role",
    default: {},
  },
  /** @type {object} */
  public_home: { type: "String", label: "Public home page", default: "" },
  /** @type {object} */
  user_home: { type: "String", label: "User home page", default: "" },
  /** @type {object} */
  staff_home: { type: "String", label: "Staff home page", default: "" },
  /** @type {object} */
  admin_home: { type: "String", label: "Admin home page", default: "" },
  /** @type {object} */
  layout_by_role: { type: "hidden", label: "Layout by role", default: {} },
  /** @type {object} */
  twofa_policy_by_role: {
    type: "hidden",
    label: "2FA policy by role",
    default: {},
  },
  /** @type {object} */
  allow_signup: {
    type: "Bool",
    label: "Allow signups",
    default: true,
    blurb: "Allow users to sign up for a new user account",
  },
  /** @type {object} */
  allow_forgot: {
    type: "Bool",
    label: "Allow password reset",
    default: false,
    blurb:
      "Allow users to request a password reset email. Email must be configured.",
  },
  /** @type {object} */
  login_menu: {
    type: "Bool",
    label: "Login in menu",
    default: true,
    blurb: "Show the login link in the menu",
  },
  /** @type {object} */
  cookie_sessions: {
    type: "Bool",
    label: "Cookie sessions",
    default: false,
    root_only: true,
    restart_required: true,
    blurb: "Store sessions entirely in client cookies for higher performance",
  },
  /** @type {object} */
  new_user_form: {
    type: "View users",
    label: "New user form",
    default: "",
    blurb: "A view to show to new users",
  },
  /** @type {object} */
  user_settings_form: {
    type: "View users",
    label: "User settings form",
    default: "",
    blurb: "A view for users to change their custom user fields",
  },
  /** @type {object} */
  login_form: {
    type: "View users",
    label: "Login view",
    blurb: "A view with the login form",
    default: "",
  },
  /** @type {object} */
  signup_form: {
    type: "View users",
    label: "Signup view",
    blurb: "A view with the signup form",
    default: "",
  },
  /** @type {object} */
  verification_view: {
    type: "View users",
    label: "Verification view",
    blurb:
      "A view with the view to be emailed to users for email address verification",
    default: "",
  },
  /** @type {object} */
  elevate_verified: {
    type: "Role",
    label: "Elevate verified to role",
    blurb:
      "Elevate users to a higher role when their email addresses have been verified",
  },
  /** @type {object} */
  min_role_upload: {
    type: "Role",
    label: "Role to upload files",
    default: "1",
    required: true,
    blurb:
      "User should have this role or higher to upload files with API (uploads through forms are not affected)",
  },
  /** @type {object} */
  min_role_apikeygen: {
    type: "Role",
    label: "Role to generate API keys",
    default: "1",
    required: true,
    blurb:
      "User should have this role or higher to generate API keys in their user settings",
  },
  /** @type {object} */
  email_mask: {
    type: "String",
    label: "Email mask",
    default: "",
    blurb: "Emails used for signup must end with this string",
  },
  /** @type {object} */
  installed_packs: { type: "String[]", label: "Installed packs", default: [] },
  /** @type {object} */
  log_sql: {
    type: "Bool",
    label: "Log SQL to stdout",
    default: false,
    onChange(val: boolean) {
      db.set_sql_logging(val);
    },
    blurb: "Print all SQL statements to the standard output",
  },
  /** @type {object} */
  multitenancy_enabled: {
    type: "Bool",
    root_only: true,
    restart_required: true,
    label: "Multitenancy enabled",
    default: db.is_it_multi_tenant(),
    onChange(val: boolean) {
      set_multitenancy_cfg(val);
    },
  },
  /** @type {object} */
  role_to_create_tenant: {
    type: "Role",
    label: "Role to create tenants",
    blurb: "Minimum user role required to create a new tenant",
    default: "10",
  },
  /** @type {object} */
  create_tenant_warning: {
    type: "Bool",
    label: "Create tenant warning",
    default: true,
    blurb:
      "Show a warning to users creating a tenant disclaiming warrenty of availability or security",
  },
  /** @type {object} */
  tenant_template: {
    type: "Tenant",
    label: "New tenant template",
    blurb: "Copy site structure for new tenants from this tenant",
  },
  /** @type {object} */
  development_mode: {
    type: "Bool",
    label: "Development mode",
    default: false,
    blurb:
      "Disable JS/CSS asset caching, show full error to user on crash, enable editing field type",
  },
  /** @type {object} */
  smtp_host: {
    type: "String",
    label: "SMTP host",
    default: "",
    blurb:
      "The host address of your SMTP server. For instance, smtp.postmarkapp.com",
  },
  /** @type {object} */
  smtp_username: {
    type: "String",
    label: "SMTP username",
    default: "",
    blurb: "The user name to access SMTP server for sending emails.",
  },
  /** @type {object} */
  smtp_password: {
    type: "String",
    label: "SMTP password",
    default: "",
    input_type: "password",
    blurb:
      "The user password or app password to access SMTP server for sending emails. " +
      "If your SMTP provider allows to create app password for using from application " +
      "We recommends to use app password instead of user password.",
  },
  /** @type {object} */
  smtp_port: {
    type: "Integer",
    label: "SMTP port",
    default: "25",
    blurb: "The port of your SMTP server",
  },
  /** @type {object} */
  smtp_secure: {
    type: "Bool",
    label: "Force TLS",
    default: false,
    sublabel:
      "Always use TLS when connecting to server? If unchecked, TLS is used if server supports the STARTTLS extension. In most cases check this box if you are connecting to port 465. For port 587 or 25 keep it unchecked",
  },
  /** @type {object} */
  email_from: {
    type: "String",
    label: "Email from address",
    default: "",
    blurb:
      "The email address from which emails are sent. For instance, hello@saltcorn.com",
  },
  /** @type {object} */
  custom_ssl_certificate: {
    type: "String",
    fieldview: "textarea",
    label: "Custom SSL certificate",
    default: "",
    hide_value: true,
  },
  /** @type {object} */
  custom_ssl_private_key: {
    type: "String",
    fieldview: "textarea",
    label: "Custom SSL private key",
    hide_value: true,
    default: "",
  },
  /** @type {object} */
  letsencrypt: {
    label: "LetsEncrypt enabled",
    default: false,
    type: "hidden",
    root_only: true,
    blurb: "Enable SSL certificate from Let's Encrypt for HTTPS traffic",
  },
  /** @type {object} */
  timeout: {
    type: "Integer",
    label: "HTTP timeout (s)",
    default: 120,
    root_only: true,
    restart_required: true,
    sublabel: "Increase if you expect large uploads",
  },
  /** @type {object} */
  latest_npm_version: {
    type: "hidden",
    label: "Latest npm version cache",
    default: {},
  },
  /** @type {object} */
  event_log_settings: {
    type: "hidden",
    label: "Event log settings",
    default: {},
  },
  /** @type {object} */
  custom_events: {
    type: "hidden",
    label: "Custom events",
    default: [],
  },
  /** @type {object} */
  page_custom_css: {
    input_type: "code",
    label: "Custom CSS",
    default: "",
    hide_value: true,
    attributes: { mode: "text/css" },
  },
  /** @type {object} */
  page_custom_html: {
    input_type: "code",
    label: "Custom HTML",
    default: "",
    hide_value: true,
    attributes: { mode: "text/html" },
  },
  /** @type {object} */
  custom_http_headers: {
    input_type: "code",
    label: "Custom HTTP headers",
    blurb: "Format for each line: Header-Name: value",
    default: "",
    hide_value: true,
    attributes: { mode: "message/http" },
  },
  /** @type {object} */
  next_hourly_event: {
    type: "Date",
    label: "Next hourly event",
    default: null,
  },
  /** @type {object} */
  next_daily_event: {
    type: "Date",
    label: "Next daily event",
    default: null,
  },
  /** @type {object} */
  next_weekly_event: {
    type: "Date",
    label: "Next weekly event",
    default: null,
  },
  /** @type {object} */
  localizer_languages: {
    type: "hidden",
    label: "Localizer languages",
    default: {},
  },
  /** @type {object} */
  localizer_strings: {
    type: "hidden",
    label: "Localizer strings",
    default: {},
  },
  cookie_duration: {
    type: "Integer",
    label: "Cookie duration (hours)",
    sublabel: "Set to 0 for expration at the end of browser session",
    default: 0,
  },
  cookie_duration_remember: {
    type: "Integer",
    label: "Cookie duration (hours) when remember ticked",
    sublabel: "Set to 0 for expration at the end of browser session",
    default: 30 * 24,
  },
  /** @type {object} */
  storage_s3_enabled: {
    type: "Bool",
    label: "Use Amazon S3",
    default: false,
    sublabel:
      "Use Amazon S3 (or compatible) service to store files. If disabled, Saltcorn uses local disk. WARNING: Changing this may break your uploaded files!",
  },
  storage_s3_secure: {
    type: "Bool",
    label: "Use Amazon S3 Secure Connection.",
    default: true,
    sublabel: "Connect to Amazon S3 (or compatible) securely.",
  },
  /** @type {object} */
  storage_s3_bucket: {
    type: "String",
    label: "Amazon S3 Bucket",
    default: "",
    blurb: "Name you selected for your S3 bucket in AWS.",
  },
  /** @type {object} */
  storage_s3_path_prefix: {
    type: "String",
    label: "Amazon S3 Path Prefix",
    default: "",
    blurb: "Prefix you selected for your S3 bucket in AWS.",
  },
  /** @type {object} */
  storage_s3_endpoint: {
    type: "String",
    label: "Amazon S3 Endpoint",
    default: "s3.amazonaws.com",
    blurb:
      "Hostname of your S3 Compatible Storage provider. Defaults to 's3.amazonaws.com'.",
  },
  /** @type {object} */
  storage_s3_region: {
    type: "String",
    label: "Amazon S3 Region",
    default: "us-east-1",
    blurb:
      "AWS region you selected when creating your S3 bucket. Default ti 'us-east-1'.",
  },
  /** @type {object} */
  storage_s3_access_key: {
    type: "String",
    label: "Amazon S3 Access Key ID",
    default: "",
    blurb:
      "Only required if you do not want to authenticate to S3 using an IAM role. Enter the Access Key ID provided by your Amazon EC2 administrator.",
  },
  /** @type {object} */
  storage_s3_access_secret: {
    type: "String",
    input_type: "password",
    label: "Amazon S3 Secret Access Key",
    default: "",
    blurb:
      "The secret access key associated with your Amazon S3 Access Key ID.",
  },
};
// TODO move list of languages from code to configuration
const available_languages = {
  en: "English",
  fr: "français",
  de: "Deutsch",
  da: "dansk",
  es: "Español",
  no: "Norsk",
  sv: "Svenska",
  ru: "русский",
  nl: "Nederlands",
  pt: "Português",
  ar: "العربية",
  it: "Italiano",
  zh: "中文",
};
/**
 * Get Config variable value by key (contract)
 * @function
 * @param {string} key
 * @param {object|undefined} def
 * @returns {Promise<object>}
 */
const getConfig = async (key: string, def?: any): Promise<any> => {
  const cfg = await db.selectMaybeOne("_sc_config", { key });
  if (cfg && typeof cfg.value === "string") return JSON.parse(cfg.value).v;
  else if (cfg) return cfg.value.v;
  else if (def) return def;
  else return configTypes[key] ? configTypes[key].default : undefined;
};

/**
 * Returns true if key is defined in fixed_configration for tenant
 * @param {string} key
 * @returns {boolean}
 */
const isFixedConfig = (key: string): boolean =>
  typeof db.connectObj.fixed_configuration[key] !== "undefined" ||
  (db.connectObj.inherit_configuration.includes(key) &&
    db.getTenantSchema() !== db.connectObj.default_schema);

/**
 * Get all config variables list
 * @function
 * @returns {Promise<object>}
 */
const getAllConfig = async (): Promise<ConfigTypes | void> => {
  const cfgs = await db.select("_sc_config");
  var cfg: ConfigTypes = {};
  cfgs.forEach(({ key, value }: { key: string; value: string | any }) => {
    if (key === "testMigration")
      //legacy invalid cfg
      return;

    try {
      cfg[key] = typeof value === "string" ? JSON.parse(value).v : value.v;
    } catch (e: any) {
      console.error(
        "config parsing error",
        e,
        { key, value },
        db.getTenantSchema()
      );
    }
  });
  return cfg;
};

/**
 * Get all config variables list
 * If variable is not defined that default value is used
 * @function
 * @returns {Promise<object>}
 */
const getAllConfigOrDefaults = async (): Promise<ConfigTypes> => {
  var cfgs: ConfigTypes = {};
  const cfgInDB = await getAllConfig();
  if (cfgInDB)
    Object.entries(configTypes).forEach(
      ([key, v]: [key: string, v: SingleConfig]) => {
        const value =
          typeof cfgInDB[key] === "undefined" ? v.default : cfgInDB[key];
        if (!isFixedConfig(key)) cfgs[key] = { value, ...v };
      }
    );
  return cfgs;
};

/**
 * Set config variable value by key
 * @function
 * @param {string} key
 * @param {object} value
 * @returns {Promise<void>}
 */
// TODO move db specific to pg/sqlite
const setConfig = async (key: string, value: any): Promise<void> => {
  if (db.isSQLite)
    await db.query(
      `insert into ${db.getTenantSchemaPrefix()}_sc_config(key, value) values($key, json($value)) 
                    on conflict (key) do update set value = json($value)`,
      { $key: key, $value: JSON.stringify({ v: value }) }
    );
  else
    await db.query(
      `insert into ${db.getTenantSchemaPrefix()}_sc_config(key, value) values($1, $2) 
                    on conflict (key) do update set value = $2`,
      [key, { v: value }]
    );
  if (configTypes[key] && configTypes[key].onChange)
    configTypes[key].onChange(value);
};

/**
 * Delete config variable
 * @function
 * @param {string} key
 * @returns {Promise<void>}
 */
const deleteConfig = async (key: string): Promise<void> => {
  await db.deleteWhere("_sc_config", { key });
};

type RemoveFromMenuOpts = {
  name: string;
  type: "View" | "Page";
};

/**
 * Remove from menu
 * @function
 * @param {object} item
 * @returns {Promise<void>}
 */
const remove_from_menu = async (item: RemoveFromMenuOpts): Promise<void> => {
  const { getState } = require("../db/state");

  const current_menu = getState().getConfigCopy("menu_items", []);
  const new_menu = current_menu.filter(
    (menuitem: any) =>
      !(
        item.type === menuitem.type &&
        (item.type === "View"
          ? menuitem.viewname === item.name
          : menuitem.pagename === item.name)
      )
  );
  await save_menu_items(new_menu);
};

const save_menu_items = async (menu_items: any[]): Promise<void> => {
  const { getState } = require("../db/state");

  const Table = (await import("./table")).default;
  const { jsexprToWhere, get_expression_function } = require("./expression");

  const unroll: (items: any[]) => Promise<any[]> = async (items) => {
    const unrolled_menu_items = [];
    for (const item of items) {
      if (item.type === "Dynamic") {
        const table = Table.findOne({ name: item.dyn_table });
        if (!table) throw new Error(`Unable to find table ${item.dyn_table}`);
        const fields = await table.getFields();
        const where = item.dyn_include_fml
          ? jsexprToWhere(item.dyn_include_fml)
          : {};
        const selopts = item.dyn_order
          ? { orderBy: db.sqlsanitize(item.dyn_order) }
          : {};
        const rows = await table.getRows(where, selopts);
        const fLabel = get_expression_function(item.dyn_label_fml, fields);
        const fUrl = get_expression_function(item.dyn_url_fml, fields);
        if (item.dyn_section_field) {
          const section_field = fields.find(
            (f) => f.name === item.dyn_section_field
          );
          if (!section_field) {
            const { InvalidConfiguration } = require("../utils");
            throw new InvalidConfiguration(
              `Dynamic menu section field ${item.dyn_section_field} not found`
            );
          }
          const sections = section_field.attributes.options
            .split(",")
            .map((s: string) => s.trim());
          for (const section of sections) {
            unrolled_menu_items.push({
              ...item,
              label: section,
              type: "Header",
              subitems: rows
                .filter((r) => r[item.dyn_section_field] === section)
                .map((row) => ({
                  ...item,
                  label: fLabel(row),
                  url: fUrl(row),
                  type: "Link",
                })),
            });
          }
        } else
          for (const row of rows) {
            unrolled_menu_items.push({
              ...item,
              label: fLabel(row),
              url: fUrl(row),
              type: "Link",
            });
          }
      } else if (item.subitems && item.subitems.length > 0) {
        const subitems = await unroll(item.subitems);
        unrolled_menu_items.push({ ...item, subitems });
      } else unrolled_menu_items.push(item);
    }
    return unrolled_menu_items;
  };
  await getState().setConfig("menu_items", menu_items);
  await getState().setConfig("unrolled_menu_items", await unroll(menu_items));
};

/**
 * Get latest npm version
 * @param {string} pkg
 * @returns {Promise<string>}
 */
const get_latest_npm_version = async (pkg: string): Promise<string> => {
  const { getState } = require("../db/state");
  const { isStale } = require("../utils");
  const stored = getState().getConfig("latest_npm_version", {});

  if (stored[pkg] && !isStale(stored[pkg].time, 6)) {
    return stored[pkg].version;
  }
  try {
    const latest = await latestVersion(pkg);
    const stored1 = getState().getConfigCopy("latest_npm_version", {});
    await getState().setConfig("latest_npm_version", {
      ...stored1,
      [pkg]: { time: new Date(), version: latest },
    });
    return latest;
  } catch (e) {
    if (stored[pkg]) return stored[pkg].version;
    else return "";
  }
};

/**
 * Ensure that string is finished with /
 * @param {string} s
 * @returns {string}
 */
const ensure_final_slash = (s: string): string =>
  s.endsWith("/") ? s : s + "/";

/**
 * Get base url
 * @param {object} req
 * @returns {string}
 */
const get_base_url = (req?: any): string => {
  const { getState } = require("../db/state");

  const cfg = getState().getConfig("base_url", "");
  if (cfg) return ensure_final_slash(cfg);
  if (!req || !req.get) return "/";
  var ports = "";
  const host = req.get("host");
  if (typeof host === "string") {
    const hosts = host.split(":");
    if (hosts.length > 1) ports = `:${hosts[1]}`;
  }
  return `${req.protocol}://${req.hostname}${ports}/`;
};

/**
 * Check email mask
 * @function
 * @param {string} email
 * @returns {boolean}
 */
const check_email_mask = (email: string): boolean => {
  const { getState } = require("../db/state");

  const cfg = getState().getConfig("email_mask", "");
  if (cfg) {
    return email.endsWith(cfg);
  } else return true;
};

/**
 * Set multitenancy cfg flag
 * @function
 * @param {boolean} val
 * @returns {void}
 */
const set_multitenancy_cfg = (val: boolean): void => {
  const cfg = getConfigFile();
  cfg.multi_tenant = val;
  writeFileSync(configFilePath, JSON.stringify(cfg, null, 2));
};

export = {
  getConfig,
  getAllConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes,
  remove_from_menu,
  available_languages,
  isFixedConfig,
  get_latest_npm_version,
  get_base_url,
  save_menu_items,
  check_email_mask,
};
