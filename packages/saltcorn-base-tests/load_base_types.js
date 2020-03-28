const { types, viewtemplates } = require("saltcorn-base-plugin");
const State = require("saltcorn-data/db/state");

module.exports = () => {
  types.forEach(t => {
    State.addType(t);
  });
  viewtemplates.forEach(vt => {
    State.viewtemplates[vt.name] = vt;
  });
};
