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
  }
  async refresh() {
    this.views = await View.find();
  }

  addType(t) {
    this.types[t.name] = t;
    if (!this.type_names.includes(t.name)) this.type_names.push(t.name);
  }
}

module.exports = new State();
