const db = require(".");
const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");

class State {
  constructor() {
    this.available_views = [];
    this.tables = [];
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
}
module.exports = new State();
