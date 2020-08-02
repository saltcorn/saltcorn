const db = require("../db");
const { contract, is } = require("contractis");

const configTypes = {
  site_name: { type: "String", label: "Site name", default: "Saltcorn" },
  site_logo_id: { type: "Integer", label: "Site logo", default: 0 },
  base_url: { type: "String", label: "Base URL", default: "" },
  menu_items: { type: "hidden", label: "Menu items" },
  globalSearch: { type: "hidden", label: "Global search" },
  available_packs: { type: "hidden", label: "Available packs" },
  available_packs_fetched_at: {
    type: "Date",
    label: "Available packs fetched"
  },
  available_plugins: { type: "hidden", label: "Available plugins" },
  available_plugins_fetched_at: {
    type: "Date",
    label: "Available plugins fetched"
  },
  public_home: { type: "String", label: "Public home page", default: "" },
  user_home: { type: "String", label: "User home page", default: "" },
  allow_signup: { type: "Bool", label: "Allow signups", default: true },
  login_menu: { type: "Bool", label: "Login in menu", default: true },
  extra_menu: {
    type: "String",
    label: "Extra menu items",
    default: "",
    sublabel: "Format: name1::URL,name2::URL"
  },
  installed_packs: { type: "String[]", label: "Installed packs", default: [] },
  log_sql: {
    type: "Bool",
    label: "Log SQL to stdout",
    default: false,
    onChange(val) {
      db.set_sql_logging(val);
    }
  },
  development_mode: { type: "Bool", label: "Development mode", default: false }
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

const getAllConfig = contract(
  is.fun([], is.promise(is.objVals(is.any))),
  async () => {
    const cfgs = await db.select("_sc_config");
    var cfg = {};
    cfgs.forEach(({ key, value }) => {
      try {
        cfg[key] = typeof value === "string" ? JSON.parse(value).v : value.v;
      } catch (e) {
        console.log("error in parsing config");
        console.log(e);
        console.log({ key, value });
        console.log("Tenant:", db.getTenantSchema());
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
      cfgs[key] = { value, ...v };
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
  async key => {
    await db.deleteWhere("_sc_config", { key });
  }
);
module.exports = {
  getConfig,
  getAllConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes
};
