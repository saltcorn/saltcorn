const { sqlsanitize } = require("@saltcorn/data/db/internal.js");
const db = require("@saltcorn/data/db");
const {
  getState,
  getTenant,
  get_other_domain_tenant,
} = require("@saltcorn/data/db/state");
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

const setLanguage = (req, res, state) => {
  if (req.user && req.user.language) {
    req.setLocale(req.user.language);
  }
  set_custom_http_headers(res, state);
};
const set_custom_http_headers = (res, state) => {
  const hdrs = (state || getState()).getConfig("custom_http_headers");
  if (!hdrs) return;
  for (const ln of hdrs.split("\n")) {
    const [k, v] = ln.split(":");
    if (v && k && v.trim) res.header(k, v.trim());
  }
};
const setTenant = (req, res, next) => {
  if (db.is_it_multi_tenant()) {
    const other_domain = get_other_domain_tenant(req.hostname);
    if (other_domain) {
      const state = getTenant(other_domain);
      if (!state) res.status(404).send(req.__("Subdomain not found"));
      else {
        db.runWithTenant(other_domain, () => {
          setLanguage(req, res, state);
          next();
        });
      }
    } else if (req.subdomains.length === 0)
      db.runWithTenant(db.connectObj.default_schema, () => {
        setLanguage(req, res);
        next();
      });
    else {
      const ten = req.subdomains[0];
      const state = getTenant(ten);
      if (!state) res.status(404).send(req.__("Subdomain not found"));
      else {
        db.runWithTenant(ten, () => {
          setLanguage(req, res, state);
          next();
        });
      }
    }
  } else {
    setLanguage(req, res);
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
  let scanstr = "";
  try {
    scanstr =
      typeof contents === "string" ? contents : JSON.stringify(contents);
  } catch {}
  if (scanstr.includes("<!--SCPT:")) {
    const start = scanstr.indexOf("<!--SCPT:");
    const end = scanstr.indexOf("-->", start);
    return scanstr.substring(start + 9, end);
  }

  return viewname;
};

const getGitRevision = () => db.connectObj.git_commit;

module.exports = {
  sqlsanitize,
  csrfField,
  loggedIn,
  isAdmin,
  setTenant,
  get_base_url,
  error_catcher,
  scan_for_page_title,
  getGitRevision,
};
