const db = require("@saltcorn/data/db");
const { pre, p, text, h3 } = require("@saltcorn/markup/tags");
const Crash = require("@saltcorn/data/models/crash");
const { getState } = require("@saltcorn/data/db/state");

module.exports = async function (err, req, res, next) {
  console.error(err.stack);
  await Crash.create(err, req);
  const devmode = getState().getConfig("development_mode", false);

  if (err.message && err.message.includes("invalid csrf token")) {
    req.flash("error", "Invalid form data, try again");
    if (req.url && req.url.includes("/auth/login")) res.redirect("/auth/login");
    else res.redirect("/");
  } else
    res.status(500).sendWrap(
      "Internal Error",
      devmode ? pre(text(err.stack)) : h3("An error occurred"),
      p(`A report has been logged and a team of bug-squashing squirrels 
    has been dispatched to deal with the situation.`)
    );
};
