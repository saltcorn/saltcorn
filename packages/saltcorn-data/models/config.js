/**
 * Config Variables
 *
 */

const db = require("../db");
const { contract, is } = require("contractis");
const latestVersion = require("latest-version");
const { getConfigFile, configFilePath } = require("../db/connect");
const fs = require("fs");
const moment = require("moment-timezone");
/**
 * Config variables types
 * @type {{custom_ssl_private_key: {default: string, fieldview: string, label: string, type: string, hide_value: boolean}, allow_signup: {default: boolean, label: string, type: string, blurb: string}, smtp_host: {default: string, label: string, type: string, blurb: string}, min_role_upload: {default: string, label: string, type: string, blurb: string, required: boolean}, next_hourly_event: {default: null, label: string, type: string}, favicon_id: {default: number, attributes: {select_file_where: {min_role_read: number, mime_super: string}}, label: string, type: string, blurb: string}, login_form: {default: string, label: string, type: string, blurb: string}, installed_packs: {default: *[], label: string, type: string}, custom_ssl_certificate: {default: string, fieldview: string, label: string, type: string, hide_value: boolean}, page_custom_css: {default: string, input_type: string, attributes: {mode: string}, label: string, hide_value: boolean}, cookie_sessions: {default: boolean, restart_required: boolean, root_only: boolean, label: string, type: string, blurb: string}, elevate_verified: {label: string, type: string, blurb: string}, available_plugins: {label: string, type: string}, login_menu: {default: boolean, label: string, type: string, blurb: string}, role_to_create_tenant: {default: string, label: string, type: string, blurb: string}, available_packs: {label: string, type: string}, site_name: {default: string, label: string, type: string, blurb: string}, log_sql: {default: boolean, onChange(*=): void, label: string, type: string, blurb: string}, next_weekly_event: {default: null, label: string, type: string}, admin_home: {default: string, label: string, type: string}, smtp_port: {default: string, label: string, type: string}, allow_forgot: {default: boolean, label: string, type: string, blurb: string}, menu_items: {label: string, type: string}, email_mask: {default: string, label: string, type: string, blurb: string}, latest_npm_version: {default: {}, label: string, type: string}, next_daily_event: {default: null, label: string, type: string}, exttables_min_role_read: {default: {}, label: string, type: string}, layout_by_role: {default: {}, label: string, type: string}, timeout: {default: number, restart_required: boolean, root_only: boolean, label: string, type: string, sublabel: string}, smtp_username: {default: string, label: string, type: string}, smtp_password: {default: string, input_type: string, label: string, type: string}, create_tenant_warning: {default: boolean, label: string, type: string, blurb: string}, home_page_by_role: {label: string, type: string}, staff_home: {default: string, label: string, type: string}, development_mode: {default: boolean, label: string, type: string, blurb: string}, page_custom_html: {default: string, input_type: string, attributes: {mode: string}, label: string, hide_value: boolean}, multitenancy_enabled: {default: boolean, restart_required: boolean, onChange(*=): void, root_only: boolean, label: string, type: string}, signup_form: {default: string, label: string, type: string, blurb: string}, user_home: {default: string, label: string, type: string}, base_url: {default: string, onChange(*=): void, label: string, type: string, blurb: string}, site_logo_id: {default: number, attributes: {select_file_where: {min_role_read: number, mime_super: string}}, label: string, type: string, blurb: string}, available_plugins_fetched_at: {label: string, type: string}, user_settings_form: {default: string, label: string, type: string, blurb: string}, public_home: {default: string, label: string, type: string}, new_user_form: {default: string, label: string, type: string, blurb: string}, smtp_secure: {default: boolean, label: string, type: string, sublabel: string}, globalSearch: {label: string, type: string}, letsencrypt: {default: boolean, root_only: boolean, label: string, type: string, blurb: string}, verification_view: {default: string, label: string, type: string, blurb: string}, available_packs_fetched_at: {label: string, type: string}, email_from: {default: string, label: string, type: string, blurb: string}, custom_http_headers: {default: string, input_type: string, attributes: {mode: string}, label: string, blurb: string, hide_value: boolean}}}
 */

const allTimezones = moment.tz.names();
const defaultTimezone = moment.tz.guess();

const configTypes = {
  site_name: {
    type: "String",
    label: "Site name",
    default: "Saltcorn",
    blurb: "A short string which is the name of your site",
  },
  timezone: {
    type: "String",
    label: "Home Timezone",
    default: defaultTimezone,
    attributes: {
      options: allTimezones,
    },
  },
  site_logo_id: {
    type: "File",
    label: "Site logo",
    default: 0,
    attributes: {
      select_file_where: { min_role_read: 10, mime_super: "image" },
    },
    blurb: "Select a publicly accessible image file for the menu logo",
  },
  favicon_id: {
    type: "File",
    label: "Favicon",
    default: 0,
    attributes: {
      select_file_where: { min_role_read: 10, mime_super: "image" },
    },
    blurb: "Select a publicly accessible image file for the browser tab icon",
  },
  base_url: {
    type: "String",
    label: "Base URL",
    default: "",
    onChange(val) {
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
  menu_items: { type: "hidden", label: "Menu items" },
  globalSearch: { type: "hidden", label: "Global search" },
  available_packs: { type: "hidden", label: "Available packs" },
  available_packs_fetched_at: {
    type: "Date",
    label: "Available packs fetched",
  },
  available_plugins: { type: "hidden", label: "Available plugins" },
  available_plugins_fetched_at: {
    type: "Date",
    label: "Available plugins fetched",
  },
  home_page_by_role: { type: "hidden", label: "Home Page by Role" },
  exttables_min_role_read: {
    type: "hidden",
    label: "Home Page by Role",
    default: {},
  },
  public_home: { type: "String", label: "Public home page", default: "" },
  user_home: { type: "String", label: "User home page", default: "" },
  staff_home: { type: "String", label: "Staff home page", default: "" },
  admin_home: { type: "String", label: "Admin home page", default: "" },
  layout_by_role: { type: "hidden", label: "Layout by role", default: {} },
  allow_signup: {
    type: "Bool",
    label: "Allow signups",
    default: true,
    blurb: "Allow users to sign up for a new user account",
  },
  allow_forgot: {
    type: "Bool",
    label: "Allow password reset",
    default: false,
    blurb:
      "Allow users to request a password reset email. Email must be configured.",
  },
  login_menu: {
    type: "Bool",
    label: "Login in menu",
    default: true,
    blurb: "Show the login link in the menu",
  },
  cookie_sessions: {
    type: "Bool",
    label: "Cookie sessions",
    default: false,
    root_only: true,
    restart_required: true,
    blurb: "Store sessions entirely in client cookies for higher performance",
  },
  new_user_form: {
    type: "View users",
    label: "New user form",
    default: "",
    blurb: "A view to show to new users",
  },
  user_settings_form: {
    type: "View users",
    label: "User settings form",
    default: "",
    blurb: "A view for users to change their custom user fields",
  },
  login_form: {
    type: "View users",
    label: "Login view",
    blurb: "A view with the login form",
    default: "",
  },
  signup_form: {
    type: "View users",
    label: "Signup view",
    blurb: "A view with the signup form",
    default: "",
  },
  verification_view: {
    type: "View users",
    label: "Verification view",
    blurb:
      "A view with the view to be emailed to users for email address verification",
    default: "",
  },
  elevate_verified: {
    type: "Role",
    label: "Elevate verified to role",
    blurb:
      "Elevate users to a higher role when their email addresses have been verified",
  },
  min_role_upload: {
    type: "Role",
    label: "Role to upload files",
    default: "1",
    required: true,
    blurb:
      "User should have this role or higher to upload files with API (uploads through forms are not affected)",
  },
  email_mask: {
    type: "String",
    label: "Email mask",
    default: "",
    blurb: "Emails used for signup must end with this string",
  },
  installed_packs: { type: "String[]", label: "Installed packs", default: [] },
  log_sql: {
    type: "Bool",
    label: "Log SQL to stdout",
    default: false,
    onChange(val) {
      db.set_sql_logging(val);
    },
    blurb: "Print all SQL statements to the standard output",
  },
  multitenancy_enabled: {
    type: "Bool",
    root_only: true,
    restart_required: true,
    label: "Multitenancy enabled",
    default: db.is_it_multi_tenant(),
    onChange(val) {
      set_multitenancy_cfg(val);
    },
  },
  role_to_create_tenant: {
    type: "Role",
    label: "Role to create tenants",
    blurb: "Minimum user role required to create a new tenant",
    default: "10",
  },
  create_tenant_warning: {
    type: "Bool",
    label: "Create tenant warning",
    default: true,
    blurb:
      "Show a warning to users creating a tenant disclaiming warrenty of availability or security",
  },
  development_mode: {
    type: "Bool",
    label: "Development mode",
    default: false,
    blurb:
      "Disable JS/CSS asset caching, show full error to user on crash, enable editing field type",
  },
  smtp_host: {
    type: "String",
    label: "SMTP host",
    default: "",
    blurb:
      "The host address of your SMTP server. For instance, smtp.postmarkapp.com",
  },
  smtp_username: {
    type: "String",
    label: "SMTP username",
    default: "",
    blurb: "The user name to access SMTP server for sending emails.",
  },
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
  smtp_port: {
    type: "Integer",
    label: "SMTP port",
    default: "25",
    blurb: "The port of your SMTP server",
  },
  smtp_secure: {
    type: "Bool",
    label: "Force TLS",
    default: false,
    sublabel:
      "Always use TLS when connecting to server? If unchecked, TLS is used if server supports the STARTTLS extension. In most cases check this box if you are connecting to port 465. For port 587 or 25 keep it unchecked",
  },
  email_from: {
    type: "String",
    label: "Email from address",
    default: "",
    blurb:
      "The email address from which emails are sent. For instance, hello@saltcorn.com",
  },
  custom_ssl_certificate: {
    type: "String",
    fieldview: "textarea",
    label: "Custom SSL certificate",
    default: "",
    hide_value: true,
  },
  custom_ssl_private_key: {
    type: "String",
    fieldview: "textarea",
    label: "Custom SSL private key",
    hide_value: true,
    default: "",
  },
  letsencrypt: {
    label: "LetsEncrypt enabled",
    default: false,
    type: "hidden",
    root_only: true,
    blurb: "Enable SSL certificate from Let's Encrypt for HTTPS traffic",
  },
  timeout: {
    type: "Integer",
    label: "HTTP timeout (s)",
    default: 120,
    root_only: true,
    restart_required: true,
    sublabel: "Increase if you expect large uploads",
  },
  latest_npm_version: {
    type: "hidden",
    label: "Latest npm version cache",
    default: {},
  },
  event_log_settings: {
    type: "hidden",
    label: "Event log settings",
    default: {},
  },
  custom_events: {
    type: "hidden",
    label: "Custom events",
    default: [],
  },
  page_custom_css: {
    input_type: "code",
    label: "Custom CSS",
    default: "",
    hide_value: true,
    attributes: { mode: "text/css" },
  },
  page_custom_html: {
    input_type: "code",
    label: "Custom HTML",
    default: "",
    hide_value: true,
    attributes: { mode: "text/html" },
  },
  custom_http_headers: {
    input_type: "code",
    label: "Custom HTTP headers",
    blurb: "Format for each line: Header-Name: value",
    default: "",
    hide_value: true,
    attributes: { mode: "message/http" },
  },
  next_hourly_event: {
    type: "Date",
    label: "Next hourly event",
    default: null,
  },
  next_daily_event: {
    type: "Date",
    label: "Next daily event",
    default: null,
  },
  next_weekly_event: {
    type: "Date",
    label: "Next weekly event",
    default: null,
  },
  localizer_languages: {
    type: "hidden",
    label: "Localizer languages",
    default: {},
  },
  localizer_strings: {
    type: "hidden",
    label: "Localizer strings",
    default: {},
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
};
/**
 * Get Config variable value by key (contract)
 * @type {*|(function(...[*]=): *)}
 */
const getConfig = contract(
  is.fun([is.str, is.maybe(is.any)], is.promise(is.any)),
  async (key, def) => {
    const cfg = await db.selectMaybeOne("_sc_config", { key });
    if (cfg && typeof cfg.value === "string") return JSON.parse(cfg.value).v;
    else if (cfg) return cfg.value.v;
    else if (def) return def;
    else return configTypes[key] ? configTypes[key].default : undefined;
  }
);
/**
 * Returns true if key is defined in fixed_configration for tenant
 * @param key
 * @returns {boolean|*}
 */
const isFixedConfig = (key) =>
  typeof db.connectObj.fixed_configuration[key] !== "undefined" ||
  (db.connectObj.inherit_configuration.includes(key) &&
    db.getTenantSchema() !== db.connectObj.default_schema);
/**
 *  Get all config variables list
 * @type {*|(function(...[*]=): *)}
 */
const getAllConfig = contract(
  is.fun([], is.promise(is.objVals(is.any))),
  async () => {
    const cfgs = await db.select("_sc_config");
    var cfg = {};
    cfgs.forEach(({ key, value }) => {
      if (key === "testMigration")
        //legacy invalid cfg
        return;

      try {
        cfg[key] = typeof value === "string" ? JSON.parse(value).v : value.v;
      } catch (e) {
        console.error(
          "config parsing error",
          e,
          { key, value },
          db.getTenantSchema()
        );
      }
    });
    return cfg;
  }
);
/**
 * Get all config variables list
 * If variable is not defined that default value is used
 * @type {*|(function(...[*]=): *)}
 */
const getAllConfigOrDefaults = contract(
  is.fun([], is.promise(is.objVals(is.any))),
  async () => {
    var cfgs = {};
    const cfgInDB = await getAllConfig();

    Object.entries(configTypes).forEach(([key, v]) => {
      const value =
        typeof cfgInDB[key] === "undefined" ? v.default : cfgInDB[key];
      if (!isFixedConfig(key)) cfgs[key] = { value, ...v };
    });
    return cfgs;
  }
);

/**
 * Set config variable value by key
 * @type {*|(function(...[*]=): *)}
 */
// TODO move db specific to pg/sqlite
const setConfig = contract(
  is.fun([is.str, is.any], is.promise(is.undefined)),
  async (key, value) => {
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
  }
);
/**
 * Delete config variable
 * @type {*|(function(...[*]=): *)}
 */
const deleteConfig = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (key) => {
    await db.deleteWhere("_sc_config", { key });
  }
);
/**
 * Remove from menu
 * @type {*|(function(...[*]=): *)}
 */
const remove_from_menu = contract(
  is.fun(
    is.obj({
      name: is.str,
      type: is.one_of(["View", "Page"]),
    }),
    is.promise(is.undefined)
  ),
  async (item) => {
    const { getState } = require("../db/state");

    const current_menu = getState().getConfigCopy("menu_items", []);
    const new_menu = current_menu.filter(
      (menuitem) =>
        !(
          item.type === menuitem.type &&
          (item.type === "View"
            ? menuitem.viewname === item.name
            : menuitem.pagename === item.name)
        )
    );
    await getState().setConfig("menu_items", new_menu);
  }
);
/**
 * Get latest npm version
 * @param pkg
 * @returns {Promise<*|string|*>}
 */
const get_latest_npm_version = async (pkg) => {
  const { getState } = require("../db/state");
  const { is_stale } = require("./pack");
  const stored = getState().getConfig("latest_npm_version", {});

  if (stored[pkg] && !is_stale(stored[pkg].time, 6)) {
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
 * @param s
 * @returns {*|string}
 */
const ensure_final_slash = (s) => (s.endsWith("/") ? s : s + "/");
/**
 * Get base url
 * @param req
 * @returns {string}
 */
const get_base_url = (req) => {
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
 * @type {*|(function(...[*]=): *)}
 */
const check_email_mask = contract(is.fun(is.str, is.bool), (email) => {
  const { getState } = require("../db/state");

  const cfg = getState().getConfig("email_mask", "");
  if (cfg) {
    return email.endsWith(cfg);
  } else return true;
});
/**
 * Set multitenancy cfg flag
 * @type {*|(function(...[*]=): *)}
 */
const set_multitenancy_cfg = contract(is.fun(is.bool, is.undefined), (val) => {
  const cfg = getConfigFile();
  cfg.multi_tenant = val;
  fs.writeFileSync(configFilePath, JSON.stringify(cfg, null, 2));
});
module.exports = {
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
  check_email_mask,
};
