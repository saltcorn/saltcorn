const db = require(".");
const Table = require("../models/table");
const Field = require("../models/field");
const View = require("../models/view");

var available_views = [];
var tables = [];
var fields = [];

const refresh = async () => {
  const new_views = await View.find();
  available_views = new_views;
};
const get_available_views = () => available_views;
refresh().then(
  () => {},
  err => {
    console.error("error refreshing cache", err);
    throw err;
  }
);

module.exports = {
  get_available_views,
  refresh
};
