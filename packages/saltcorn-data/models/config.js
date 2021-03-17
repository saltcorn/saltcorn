const db = require("../db");
const { contract, is } = require("contractis");
const latestVersion = require("latest-version");
const { getConfigFile, configFilePath } = require("../db/connect");
const fs = require("fs");

const configTypes = {
  site_name: {
    type: "String",
    label: "Site name",
    default: "Saltcorn",
    blurb: "A short string which is the name of your site",
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
  new_user_form: {
    type: "View users",
    label: "New user form",
    default: "",
    blurb: "A view to show to new users",
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
  smtp_username: { type: "String", label: "SMTP username", default: "" },
  smtp_password: {
    type: "String",
    label: "SMTP password",
    default: "",
    input_type: "password",
  },
  smtp_port: { type: "Integer", label: "SMTP port", default: "25" },
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
    blurb: "Enable SSL certificate from Let's Encrypt for HTTPS traffic",
  },
  latest_npm_version: {
    type: "hidden",
    label: "Layout by role",
    default: {},
    label: "Latest npm version cache",
  },
  page_custom_css: {
    type: "String",
    fieldview: "textarea",
    label: "Custom CSS",
    default: "",
    hide_value: true,
  },
  page_custom_html: {
    type: "String",
    fieldview: "textarea",
    label: "Custom HTML",
    default: "",
    hide_value: true,
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
};

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

const isFixedConfig = (key) =>
  typeof db.connectObj.fixed_configuration[key] !== "undefined" ||
  (db.connectObj.inherit_configuration.includes(key) &&
    db.getTenantSchema() !== db.connectObj.default_schema);

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

const deleteConfig = contract(
  is.fun(is.str, is.promise(is.undefined)),
  async (key) => {
    await db.deleteWhere("_sc_config", { key });
  }
);

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

    const current_menu = getState().getConfig("menu_items", []);
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

const get_latest_npm_version = async (pkg) => {
  const { getState } = require("../db/state");
  const { is_stale } = require("./pack");
  const stored = getState().getConfig("latest_npm_version", {});

  if (stored[pkg] && !is_stale(stored[pkg].time, 6)) {
    return stored[pkg].version;
  }
  try {
    const latest = await latestVersion(pkg);
    const stored1 = getState().getConfig("latest_npm_version", {});
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
const ensure_final_slash = (s) => (s.endsWith("/") ? s : s + "/");

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

const check_email_mask = contract(is.fun(is.str, is.bool), (email) => {
  const { getState } = require("../db/state");

  const cfg = getState().getConfig("email_mask", "");
  if (cfg) {
    return email.endsWith(cfg);
  } else return true;
});

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
