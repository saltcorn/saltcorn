const { contract, is } = require("contractis");
const {
  is_plugin_wrap,
  is_plugin,
  is_header,
  is_viewtemplate,
  is_plugin_type
} = require("../contracts");

const db = require(".");
const { migrate } = require("../migrate");
const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");
const { getAllTenants, createTenant } = require("../models/tenant");
const {
  getAllConfigOrDefaults,
  setConfig,
  deleteConfig,
  configTypes
} = require("../models/config");

class State {
  constructor() {
    this.views = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.pages = {};
    this.fields = [];
    this.configs = {};
    this.plugins = {};
    this.layout = { wrap: s => s };
    this.headers = [];
    contract.class(this);
  }

  async refresh() {
    this.views = await View.find();
    this.configs = await getAllConfigOrDefaults();
  }

  getConfig(key, def) {
    if (this.configs[key] && typeof this.configs[key].value !== "undefined")
      return this.configs[key].value;
    if (def) return def;
    else return configTypes[key] && configTypes[key].default;
  }

  async setConfig(key, value) {
    await setConfig(key, value);
    this.configs[key].value = value;
  }
  async deleteConfig(key) {
    await deleteConfig(key);
    delete this.configs[key];
  }

  registerPlugin(name, plugin) {
    this.plugins[name] = plugin;
    (plugin.types || []).forEach(t => {
      this.addType(t);
    });
    (plugin.viewtemplates || []).forEach(vt => {
      this.viewtemplates[vt.name] = vt;
    });
    Object.entries(plugin.pages || {}).forEach(([k, v]) => {
      this.pages[k] = v;
    });
    if (plugin.layout && plugin.layout.wrap)
      this.layout.wrap = contract(is_plugin_wrap, plugin.layout.wrap);
    (plugin.headers || []).forEach(h => {
      if (!this.headers.includes(h)) this.headers.push(h);
    });
  }
  get type_names() {
    return Object.keys(this.types);
  }
  addType(t) {
    this.types[t.name] = t;
  }
}

State.contract = {
  variables: {
    headers: is.array(is_header),
    viewtemplates: is.objVals(is_viewtemplate),
    types: is.objVals(is_plugin_type)
  },
  methods: {
    addType: is.fun(is_plugin_type, is.eq(undefined)),
    registerPlugin: is.fun([is.str, is_plugin], is.eq(undefined)),
    refresh: is.fun([], is.promise(is.eq(undefined))),
    type_names: is.getter(is.array(is.str))
  }
};

const singleton = new State();

const getState = contract(is.fun([], is.class("State")), () => {
  if (!db.is_it_multi_tenant()) return singleton;

  const ten = db.getTenantSchema();
  if (ten === "public") return singleton;
  else return tenants[ten];
});

var tenants = {};

const init_multi_tenant = async plugin_loader => {
  const tenantList = await getAllTenants();
  for (const domain of tenantList) {
    tenants[domain] = new State();
    await db.runWithTenant(domain, () => migrate(domain));
    await db.runWithTenant(domain, plugin_loader);
  }
};

const create_tenant = async (t, plugin_loader) => {
  await createTenant(t);
  tenants[t.subdomain] = new State();
  await db.runWithTenant(t.subdomain, plugin_loader);
};

const restart_tenant = async plugin_loader => {
  const ten = db.getTenantSchema();
  tenants[ten] = new State();
  await plugin_loader();
};

module.exports = { getState, init_multi_tenant, create_tenant, restart_tenant };
