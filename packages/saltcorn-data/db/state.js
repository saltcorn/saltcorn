const { contract, is } = require("contractis");
const {
  is_plugin_wrap,
  is_plugin,
  is_header,
  is_viewtemplate,
  is_plugin_type
} = require("../contracts");

const db = require(".");
const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");
const {
  getAllConfigOrDefaults,
  setConfig,
  deleteConfig
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
    else return def;
  }

  async setConfig(key, value) {
    await setConfig(key, value);
    this.configs[key].value = value;
  }
  async deleteConfig(key) {
    await deleteConfig(key);
    delete this.configs[key];
  }

  registerPlugin(plugin) {
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
    if (!this.type_names.includes(t.name)) this.type_names.push(t.name);
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
    registerPlugin: is.fun(is_plugin, is.eq(undefined)),
    refresh: is.fun([], is.promise(is.eq(undefined))),
    type_names: is.getter(is.array(is.str))
  }
};

const singleton = new State()

const getState = ()=> singleton

module.exports = { getState } ;
