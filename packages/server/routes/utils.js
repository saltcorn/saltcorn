const { sqlsanitize } = require("@saltcorn/data/db/internal.js");
const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");
const { input } = require("@saltcorn/markup/tags");

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
    const ten =
      req.subdomains.length > 0 && req.subdomains[0] !== "www"
        ? req.subdomains[0]
        : "public";
    db.runWithTenant(ten, () => {
      next();
    });
  } else {
    next();
  }
};
const ensure_final_slash = s => (s.endsWith("/") ? s : s + "/");

const get_base_url = req => {
  const cfg = getState().getConfig("base_url", "");
  if (cfg) return ensure_final_slash(cfg);

  var ports = "";
  const host = req.get("host");
  if (typeof host === "string") {
    const hosts = host.split(":");
    if (hosts.length > 1) ports = `:${hosts[1]}`;
  }
  return `${req.protocol}://${req.hostname}${ports}/`;
};

const csrfField = req =>
  input({
    type: "hidden",
    name: "_csrf",
    value: req.csrfToken ? req.csrfToken() : req
  });

module.exports = {
  sqlsanitize,
  csrfField,
  loggedIn,
  isAdmin,
  setTenant,
  get_base_url
};
