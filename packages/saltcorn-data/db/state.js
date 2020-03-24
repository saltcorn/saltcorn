const db = require(".");
const {string, int, bool} = require("./types");
const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");

class State {
  constructor() {
    this.available_views = [];
    this.viewtemplates = {};
    this.tables = [];
    this.types = {};
    this.types_list = [string, int, bool];
    this.type_names = []
    this.update_types()
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

  update_types() {
    var d = {};
    this.types_list.forEach(t => {
      d[t.name] = t;
    });
    this.type_names = this.types_list.map(t => t.name)
    this.types=d
  };
  addType(t) {
    this.types_list.push(t)
    this.update_types()
  }
}

module.exports = new State();
