const { contract, is } = require("contractis");
const {
  is_plugin_wrap,
  is_plugin,
  is_header,
  is_viewtemplate,
  is_plugin_type,
  is_plugin_layout,
} = require("../contracts");

const db = require(".");
const { migrate } = require("../migrate");
const Table = require("../models/table");
const File = require("../models/file");
const Field = require("../models/field");
const View = require("../models/view");
const { getAllTenants, createTenant } = require("../models/tenant");
const {
  getAllConfigOrDefaults,
  setConfig,
  deleteConfig,
  configTypes,
} = require("../models/config");
const emergency_layout = require("@saltcorn/markup/emergency_layout");

class State {
  constructor() {
    this.views = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.pages = {};
    this.fields = [];
    this.configs = {};
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.favicon = null;
    this.plugins = {};
    this.plugin_cfgs = {};
    this.layouts = { emergency: { wrap: emergency_layout } };
    this.headers = [];
    this.function_context = {};
    this.functions = {};
    this.keyFieldviews = {};
    contract.class(this);
  }
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
  async refresh() {
    this.views = await View.find();
    this.configs = await getAllConfigOrDefaults();
    const favicons = await File.find({ filename: "favicon.png" });
    if (favicons && favicons.length > 0) this.favicon = favicons[0];
    else this.favicon = null;
  }

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

  async setConfig(key, value) {
    await setConfig(key, value);
    this.configs[key] = { value };
  }
  async deleteConfig(key) {
    await deleteConfig(key);
    delete this.configs[key];
  }

  registerPlugin(name, plugin, cfg) {
    this.plugins[name] = plugin;
    this.plugin_cfgs[name] = cfg;

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
    Object.entries(withCfg("pages", {})).forEach(([k, v]) => {
      this.pages[k] = v;
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
    Object.entries(withCfg("authentication", {})).forEach(([k, v]) => {
      this.auth_methods[k] = v;
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
    withCfg("headers", []).forEach((h) => {
      if (!this.headers.includes(h)) this.headers.push(h);
    });
  }
  get type_names() {
    return Object.keys(this.types);
  }
  addType(t) {
    this.types[t.name] = t;
  }

  remove_plugin(name) {
    delete this.plugins[name];
    this.reload_plugins();
  }

  reload_plugins() {
    this.views = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.pages = {};
    this.fields = [];
    this.configs = {};
    this.fileviews = {};
    this.actions = {};
    this.auth_methods = {};
    this.favicon = null;
    this.layouts = { emergency: { wrap: emergency_layout } };
    this.headers = [];
    this.function_context = {};
    this.functions = {};
    this.keyFieldviews = {};
    Object.entries(this.plugins).forEach(([k, v]) => {
      this.registerPlugin(k, v, this.plugin_cfgs[k]);
    });
    this.refresh();
  }
}

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

const singleton = new State();

const getState = contract(is.fun([], is.class("State")), () => {
  if (!db.is_it_multi_tenant()) return singleton;

  const ten = db.getTenantSchema();
  if (ten === db.connectObj.default_schema) return singleton;
  else return tenants[ten];
});

var tenants = {};

const getTenant = (ten) => tenants[ten];

const init_multi_tenant = async (plugin_loader, disableMigrate) => {
  const tenantList = await getAllTenants();
  for (const domain of tenantList) {
    try {
      tenants[domain] = new State();
      if (!disableMigrate)
        await db.runWithTenant(domain, () => migrate(domain));
      await db.runWithTenant(domain, plugin_loader);
    } catch (err) {
      console.error(
        `init_multi_tenant error in domain ${domain}: `,
        err.message
      );
    }
  }
};

const create_tenant = async (t, plugin_loader) => {
  await createTenant(t);
  tenants[t] = new State();
  await db.runWithTenant(t, plugin_loader);
};

const restart_tenant = async (plugin_loader) => {
  const ten = db.getTenantSchema();
  tenants[ten] = new State();
  await plugin_loader();
};

module.exports = {
  getState,
  getTenant,
  init_multi_tenant,
  create_tenant,
  restart_tenant,
};
