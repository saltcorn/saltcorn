/**
 * @category server
 * @module routes/utils
 * @subcategory routes
 */

const db = require("@saltcorn/data/db");
const { sqlsanitize } = db;
const {
  getState,
  getTenant,
  get_other_domain_tenant,
} = require("@saltcorn/data/db/state");
const { get_base_url } = require("@saltcorn/data/models/config");
const { input } = require("@saltcorn/markup/tags");
const session = require("express-session");
const cookieSession = require("cookie-session");
const is = require("contractis/is");
const { validateHeaderName, validateHeaderValue } = require("http");
const Crash = require("@saltcorn/data/models/crash");

/**
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @returns {void}
 */
function loggedIn(req, res, next) {
  if (req.user && req.user.id && req.user.tenant === db.getTenantSchema()) {
    next();
  } else {
    req.flash("danger", req.__("Must be logged in first"));
    res.redirect("/auth/login");
  }
}

/**
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @returns {void}
 */
function isAdmin(req, res, next) {
  if (
    req.user &&
    req.user.role_id === 1 &&
    req.user.tenant === db.getTenantSchema()
  ) {
    next();
  } else {
    req.flash("danger", req.__("Must be admin"));
    res.redirect(
      req.user && req.user.pending_user
        ? "/auth/twofa/login/totp"
        : req.user
        ? "/"
        : "/auth/login"
    );
  }
}

/**
 * @param {object} req
 * @param {object} res
 * @param {string} state
 * @returns {void}
 */
const setLanguage = (req, res, state) => {
  if (req.user && req.user.language) {
    req.setLocale(req.user.language);
  }
  set_custom_http_headers(res, state);
};

/**
 * @param {object} res
 * @param {string} state
 * @returns {void}
 */
const set_custom_http_headers = (res, state) => {
  const hdrs = (state || getState()).getConfig("custom_http_headers");
  if (!hdrs) return;
  for (const ln of hdrs.split("\n")) {
    const [k, v] = ln.split(":");
    if (v && k && v.trim) {
      try {
        const val = v.trim();
        validateHeaderName(k);
        validateHeaderValue(k, val);
        res.header(k, val);
      } catch (e) {
        Crash.create(e, { url: "/", headers: {} });
      }
    }
  }
};

/**
 * @param {object} req
 * @returns {string}
 */
const get_tenant_from_req = (req) => {
  if (req.subdomains && req.subdomains.length > 0)
    return req.subdomains[req.subdomains.length - 1];

  if (req.headers["x-saltcorn-app"])
    return req.headers["x-saltcorn-app"];
  if (req.subdomains && req.subdomains.length == 0)
    return db.connectObj.default_schema;
  if (!req.subdomains && req.headers.host) {
    const parts = req.headers.host.split(".");
    if (parts.length < 3) return db.connectObj.default_schema;
    else return parts[0];
  }
};

/**
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
const setTenant = (req, res, next) => {
  if (db.is_it_multi_tenant()) {
    const other_domain = get_other_domain_tenant(req.hostname);
    if (other_domain) {
      const state = getTenant(other_domain);
      if (!state) {
        setLanguage(req, res);
        next();
      } else {
        db.runWithTenant(other_domain, () => {
          setLanguage(req, res, state);
          state.log(5, `${req.method} ${req.originalUrl}`);
          next();
        });
      }
    } else {
      const ten = get_tenant_from_req(req);
      const state = getTenant(ten);
      if (!state) {
        setLanguage(req, res);
        next();
      } else {
        db.runWithTenant(ten, () => {
          setLanguage(req, res, state);
          state.log(5, `${req.method} ${req.originalUrl}`);
          next();
        });
      }
    }
  } else {
    setLanguage(req, res);
    getState().log(5, `${req.method} ${req.originalUrl}`);
    next();
  }
};

/**
 * @param {object} req
 * @returns {input}
 */
const csrfField = (req) =>
  input({
    type: "hidden",
    name: "_csrf",
    value: req.csrfToken ? req.csrfToken() : req,
  });

/**
 * @param {function} fn
 * @returns {function}
 */
const error_catcher = (fn) => (request, response, next) => {
  Promise.resolve(fn(request, response, next)).catch(next);
};

/**
 * @param {string|object} contents
 * @param {string} viewname
 * @returns {string}
 */
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

/**
 * @returns {string}
 */
const getGitRevision = () => db.connectObj.git_commit;

/**
 * @returns {session|cookieSession}
 */
const getSessionStore = () => {
  if (getState().getConfig("cookie_sessions", false)) {
    return cookieSession({
      keys: [db.connectObj.session_secret || is.str.generate()],
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
    });
  } else if (db.isSQLite) {
    var SQLiteStore = require("connect-sqlite3")(session);
    return session({
      store: new SQLiteStore({ db: "sessions.sqlite" }),
      secret: db.connectObj.session_secret || is.str.generate(),
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "strict" }, // 30 days
    });
  } else {
    const pgSession = require("connect-pg-simple")(session);
    return session({
      store: new pgSession({
        schemaName: db.connectObj.default_schema,
        pool: db.pool,
        tableName: "_sc_session",
      }),
      secret: db.connectObj.session_secret || is.str.generate(),
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    });
  }
};

module.exports = {
  sqlsanitize,
  csrfField,
  loggedIn,
  isAdmin,
  get_base_url,
  error_catcher,
  scan_for_page_title,
  getGitRevision,
  getSessionStore,
  setTenant,
  get_tenant_from_req
};
