const { sqlsanitize } = require("saltcorn-data/db/internal.js");
const db = require("saltcorn-data/db");

function loggedIn(req, res, next) {
  if (req.user && req.user.tenant === db.getTenantSchema()) {
    next();
  } else {
    req.flash("danger", "Must be logged in first");
    res.redirect("/auth/login");
  }
}

function isAdmin(req, res, next) {
  if (
    req.user &&
    req.user.role_id === 1 &&
    req.user.tenant === db.getTenantSchema()
  ) {
    next();
  } else {
    req.flash("danger", "Must be admin");
    res.redirect(req.user ? "/" : "/auth/login");
  }
}

const setTenant = (req, res, next) => {
  if (db.is_it_multi_tenant()) {
    const ten = req.subdomains.length > 0 ? req.subdomains[0] : "public";
    db.getTenantNS().run(ten, () => {
      next();
    });
  } else {
    next();
  }
};

module.exports = {
  sqlsanitize,
  loggedIn,
  isAdmin,
  setTenant
};
