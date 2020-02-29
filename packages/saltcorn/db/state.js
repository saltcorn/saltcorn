const db = require(".");
const Table = require("./table");
const Field = require("./field");
const View = require("./view");

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
