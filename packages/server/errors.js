const db = require("@saltcorn/data/db");
const { pre, p } = require("@saltcorn/markup/tags");


module.exports = async function (err, req, res, next) {
    console.error(err.stack)
    res.status(500).sendWrap('Internal Error', pre(err.stack)+p(`A report has been logged and a team of bug-squashing squirrels 
    has been dispatched to deal with the situation.`))
  }