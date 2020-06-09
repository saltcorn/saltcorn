const db = require("../db");
const { contract, is } = require("contractis");

const configTypes = {
  site_name: { type: "String", label: "Site name", default: "Saltcorn" },
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
  }
};

const getConfig = async (key, def) => {
  const cfg = await db.selectMaybeOne("_sc_config", { key });
  if (cfg) return cfg.value.v;
  else if (def) return def;
  else return configTypes[key] ? configTypes[key].default : undefined;
};

const getAllConfig = async () => {
  const cfgs = await db.select("_sc_config");
  var cfg = {};
  cfgs.forEach(({ key, value }) => {
    cfg[key] = value.v;
  });
  return cfg;
};

const getAllConfigOrDefaults = async () => {
  var cfgs = {};
  const cfgInDB = await getAllConfig();

  Object.entries(configTypes).forEach(([key, v]) => {
    const value =
      typeof cfgInDB[key] === "undefined" ? v.default : cfgInDB[key];
    cfgs[key] = { value, ...v };
  });
  return cfgs;
};

const setConfig = async (key, value) => {
  await db.query(
    `insert into "${db.getTenantSchema()}"._sc_config(key, value) values($1, $2) 
                    on conflict (key) do update set value = $2`,
    [key, { v: value }]
  );
  if (configTypes[key] && configTypes[key].onChange)
    configTypes[key].onChange(value);
};

const deleteConfig = async key => {
  await db.deleteWhere("_sc_config", { key });
};
module.exports = {
  getConfig,
  getAllConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes
};
