const db = require("@saltcorn/data/db");
const { pre, p, text, h3 } = require("@saltcorn/markup/tags");
const Crash = require("@saltcorn/data/models/crash");
const { getState } = require("@saltcorn/data/db/state");

module.exports = async function (err, req, res, next) {
  const devmode = getState().getConfig("development_mode", false);
  const log_sql = getState().getConfig("log_sql", false);
  const role = (req.user || {}).role_id || 10;
  if (err.message && err.message.includes("invalid csrf token")) {
    console.error(err.message);

    req.flash("error", req.__("Invalid form data, try again"));
    if (req.url && req.url.includes("/auth/login")) res.redirect("/auth/login");
    else res.redirect("/");
    return;
  }
  console.error(err.stack);
  if (!(devmode && log_sql)) await Crash.create(err, req);

  if (req.xhr) {
    res
      .status(500)
      .send(
        devmode || role === 1 ? text(err.message) : req.__("An error occurred")
      );
  } else
    res
      .status(500)
      .sendWrap(
        req.__("Internal Error"),
        devmode ? pre(text(err.stack)) : h3(req.__("An error occurred")),
        role === 1 && !devmode ? pre(text(err.message)) : "",
        p(
          req.__(
            `A report has been logged and a team of bug-squashing squirrels has been dispatched to deal with the situation.`
          )
        )
      );
};
