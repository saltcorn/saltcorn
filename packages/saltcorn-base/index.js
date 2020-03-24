const State = require("saltcorn-data/db/state");
const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");
const { string, int, bool } = require("./types");

const register = () => {
  State.viewtemplates.list = list;
  State.viewtemplates.show = show;
  State.addType(string);
  State.addType(int);
  State.addType(bool);
};

module.exports = { register };
