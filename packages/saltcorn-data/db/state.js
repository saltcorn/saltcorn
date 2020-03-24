const db = require(".");
const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");

class State {
  constructor() {
    this.available_views = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.type_names = [];
    this.fields = [];
    this.refresh().then(
      () => {},
      err => {
        console.error("error refreshing cache", err);
        throw err;
      }
    );
  }
  async refresh() {
    this.available_views = await View.find();
  }

  addType(t) {
    this.types[t.name] = t;
    if (!this.type_names.includes(t.name)) this.type_names.push(t.name);
  }
}

module.exports = new State();
