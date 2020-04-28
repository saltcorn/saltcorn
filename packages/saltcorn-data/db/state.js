const db = require(".");
const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");

class State {
  constructor() {
    this.views = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.type_names = [];
    this.fields = [];
    this.layout = { wrap: s => s };
    this.headers = [];
  }

  async refresh() {
    this.views = await View.find();
  }

  registerPlugin(plugin) {
    (plugin.types || []).forEach(t => {
      this.addType(t);
    });
    (plugin.viewtemplates || []).forEach(vt => {
      this.viewtemplates[vt.name] = vt;
    });
    if (plugin.layout && plugin.layout.wrap)
      this.layout.wrap = plugin.layout.wrap;
    if (plugin.headers)
      if (!this.headers.includes(plugin.headers))
        plugin.headers.forEach(h => {
          this.headers.push(h);
        });
  }

  addType(t) {
    this.types[t.name] = t;
    if (!this.type_names.includes(t.name)) this.type_names.push(t.name);
  }
}

module.exports = new State();
