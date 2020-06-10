const db = require("@saltcorn/data/db");
const { pre, p, text } = require("@saltcorn/markup/tags");
const Crash = require("@saltcorn/data/models/crash");

module.exports = async function(err, req, res, next) {
  console.error(err.stack);
  await Crash.create(err, req);
  res.status(500).sendWrap(
    "Internal Error",
    pre(text(err.stack)) +
      p(`A report has been logged and a team of bug-squashing squirrels 
    has been dispatched to deal with the situation.`)
  );
};
