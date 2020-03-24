const State = require("saltcorn-data/db/state");
const list = require("./viewtemplates/list");
const show = require("./viewtemplates/show");

const register = () => {
    State.viewtemplates.list = list
    State.viewtemplates.show = show
}



module.exports = {register}