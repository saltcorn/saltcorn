const { sqlsanitize } = require("@saltcorn/data/db/internal.js");
const db = require("@saltcorn/data/db");
const { getState, getTenant, get_other_domain_tenant } = require("@saltcorn/data/db/state");
const { get_base_url } = require("@saltcorn/data/models/config");
const { input } = require("@saltcorn/markup/tags");

function loggedIn(req, res, next) {
  if (req.user && req.user.id && req.user.tenant === db.getTenantSchema()) {
    next();
  } else {
    req.flash("danger", req.__("Must be logged in first"));
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
    req.flash("danger", req.__("Must be admin"));
    res.redirect(req.user ? "/" : "/auth/login");
  }
}

const setLanguage = (req) => {
  if (req.user && req.user.language) {
    req.setLocale(req.user.language);
  }
};

const setTenant = (req, res, next) => {
  if (db.is_it_multi_tenant()) {
    const other_domain = get_other_domain_tenant(req.hostname)
    if(other_domain) {
      const state = getTenant(other_domain);
      if (!state) res.status(404).send(req.__("Subdomain not found"));
      else {
        db.runWithTenant(other_domain, () => {
          setLanguage(req);
          next();
        });
      }
    } else 
    if (req.subdomains.length === 0)
      db.runWithTenant(db.connectObj.default_schema, () => {
        setLanguage(req);
        next();
      });
    else {
      const ten = req.subdomains[0];
      const state = getTenant(ten);
      if (!state) res.status(404).send(req.__("Subdomain not found"));
      else {
        db.runWithTenant(ten, () => {
          setLanguage(req);
          next();
        });
      }
    }
  } else {
    setLanguage(req);
    next();
  }
};

const csrfField = (req) =>
  input({
    type: "hidden",
    name: "_csrf",
    value: req.csrfToken ? req.csrfToken() : req,
  });

const error_catcher = (fn) => (request, response, next) => {
  Promise.resolve(fn(request, response, next)).catch(next);
};
const scan_for_page_title = (contents, viewname) => {
  if (typeof contents === "string" && contents.includes("<!--SCPT:")) {
    const start = contents.indexOf("<!--SCPT:");
    const end = contents.indexOf("-->", start);
    return contents.substring(start + 9, end);
  }

  return viewname;
};
module.exports = {
  sqlsanitize,
  csrfField,
  loggedIn,
  isAdmin,
  setTenant,
  get_base_url,
  error_catcher,
  scan_for_page_title,
};
