const State = require("saltcorn-data/db/state");
const wrap = require("./wrap");
const register = () => {
  State.layout.wrap = wrap;
};

module.exports = { register };
