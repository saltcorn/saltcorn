const { types } = require("saltcorn-base-plugin");
const State = require("saltcorn-data/db/state");

module.exports = () => {
  types.forEach(t => {
    State.addType(t);
  });
};
