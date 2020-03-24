const list = require("./list");
const show = require("./show");
const State = require("saltcorn-data/db/state");

State.viewtemplates.list = list
State.viewtemplates.show = show

module.exports = {
  list,
  show
};
