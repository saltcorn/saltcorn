const db = require("@saltcorn/data/db");
const { pre, p, text, h3 } = require("@saltcorn/markup/tags");
const Crash = require("@saltcorn/data/models/crash");
const { getState } = require("@saltcorn/data/db/state");

module.exports = async function (err, req, res, next) {
  console.error(err.stack);
  await Crash.create(err, req);
  const devmode = getState().getConfig("development_mode", false);
  const role = (req.user || {}).role_id || 10;
  if (err.message && err.message.includes("invalid csrf token")) {
    req.flash("error", res.__("Invalid form data, try again"));
    if (req.url && req.url.includes("/auth/login")) res.redirect("/auth/login");
    else res.redirect("/");
  } else if (req.xhr) {
    res
      .status(500)
      .send(
        devmode || role === 1 ? text(err.message) : res.__("An error occurred")
      );
  } else
    res
      .status(500)
      .sendWrap(
        res.__("Internal Error"),
        devmode ? pre(text(err.stack)) : h3(res.__("An error occurred")),
        role === 1 && !devmode ? pre(text(err.message)) : "",
        p(
          res.__(
            `A report has been logged and a team of bug-squashing squirrels has been dispatched to deal with the situation.`
          )
        )
      );
};
