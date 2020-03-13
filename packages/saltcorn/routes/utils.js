const types = require("../types");
const { sqlsanitize, fkeyPrefix } = require("../db/internal.js");

function loggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    req.flash("danger", "Must be logged in first");
    res.redirect("/auth/login");
  }
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role_id === 1) {
    next();
  } else {
    req.flash("danger", "Must be admin");
    res.redirect(req.user ? "/" : "/auth/login");
  }
}

module.exports = {
  sqlsanitize,
  fkeyPrefix,
  loggedIn,
  isAdmin
};
