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
  features,
} = require("@saltcorn/data/db/state");
const { get_base_url } = require("@saltcorn/data/models/config");
const {
  hash,
  is_relative_url,
  normalize_relative_url,
} = require("@saltcorn/data/utils");
const { input, script, domReady, a, text } = require("@saltcorn/markup/tags");
const session = require("express-session");
const cookieSession = require("cookie-session");
const is = require("contractis/is");
const { validateHeaderName, validateHeaderValue } = require("http");
const Crash = require("@saltcorn/data/models/crash");
const File = require("@saltcorn/data/models/file");
const User = require("@saltcorn/data/models/user");
const Page = require("@saltcorn/data/models/page");
const Trigger = require("@saltcorn/data/models/trigger");
const si = require("systeminformation");
const {
  config_fields_form,
  save_config_from_form,
  check_if_restart_required,
  flash_restart,
} = require("../markup/admin.js");
const path = require("path");
const { UAParser } = require("ua-parser-js");
const crypto = require("crypto");
const { domain_sanitize } = require("@saltcorn/admin-models/models/tenant");

const get_sys_info = async () => {
  const disks = await si.fsSize();
  let size = 0;
  let used = 0;
  disks.forEach((d) => {
    if (d && d.used && d.size) {
      size += d.size;
      used += d.used;
    }
  });
  const diskUsage = Math.round(100 * (used / size));
  const simem = await si.mem();
  const memUsage = Math.round(100 - 100 * (simem.available / simem.total));
  const cpuUsage = Math.round((await si.currentLoad()).currentLoad);
  return { memUsage, diskUsage, cpuUsage };
};

/**
 * Checks that user logged or not.
 * If not shows than shows flash and redirects to login
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @returns {void}
 */
function loggedIn(req, res, next) {
  if (req.user && req.user.id) {
    // Reject tenant drift so a session authenticated elsewhere cannot be reused here.
    if (
      req.user.tenant !== undefined &&
      req.user.tenant !== db.getTenantSchema()
    ) {
      req.logout?.(() => {});
      return res.status(403).json({ error: "Session tenant mismatch" });
    }
    next();
  } else {
    req.flash("danger", req.__("Must be logged in first"));
    res.redirect("/auth/login");
  }
}

/**
 * Checks that user has admin role or not.
 * If user hasn't admin role shows flash and redirects user to login or totp
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @returns {void}
 */
function isAdmin(req, res, next) {
  const cur_tenant = db.getTenantSchema();
  //console.log({ cur_tenant, user: req.user });
  if (req.user && req.user.role_id === 1) {
    // Reject tenant drift before honoring elevated privileges in this schema.
    if (req.user.tenant !== undefined && req.user.tenant !== cur_tenant) {
      req.logout?.(() => {});
      return res.status(403).json({ error: "Session tenant mismatch" });
    }
    next();
  } else {
    req.flash("danger", req.__("Must be admin"));
    res.redirect(
      req.user && req.user.pending_user
        ? "/auth/twofa/login/totp"
        : req.user
          ? "/"
          : `/auth/login?dest=${encodeURIComponent(req.originalUrl)}`
    );
  }
}

/**
 * Reject a request whose session/JWT identity was authenticated in a different
 * tenant than the one resolved for this request (from the subdomain). The
 * session store and cookie are shared across all tenants, so without this a
 * session minted in tenant A could be replayed against tenant B and have its
 * home-tenant role applied to tenant B's data. This is the API-router
 * equivalent of the drift guard already enforced in `loggedIn`/`isAdmin`.
 * Bearer (api_token) requests are not authenticated at this point (that happens
 * per-route and is already scoped to the request's schema), so `req.user` is
 * unset for them and they pass through untouched.
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @returns {void}
 */
function rejectTenantDrift(req, res, next) {
  if (
    req.user &&
    req.user.tenant !== undefined &&
    req.user.tenant !== db.getTenantSchema()
  ) {
    req.logout?.(() => {});
    return res.status(403).json({ error: "Session tenant mismatch" });
  }
  next();
}

const isAdminOrHasConfigMinRole = (cfg) => (req, res, next) => {
  const cur_tenant = db.getTenantSchema();
  //console.log({ cur_tenant, user: req.user });
  if (
    req.user &&
    (req.user.role_id === 1 ||
      (Array.isArray(cfg)
        ? cfg.some(
            (one_cfg) => getState().getConfig(one_cfg, 1) >= req.user.role_id
          )
        : getState().getConfig(cfg, 1) >= req.user.role_id)) &&
    req.user.tenant === cur_tenant
  ) {
    next();
  } else {
    req.flash("danger", req.__("Must be admin"));
    res.redirect(
      req.user && req.user.pending_user
        ? "/auth/twofa/login/totp"
        : req.user
          ? "/"
          : `/auth/login?dest=${encodeURIComponent(req.originalUrl)}`
    );
  }
};

/**
 * Sets language for HTTP Request / HTTP Responce
 * @param {object} req
 * @param {object} res
 * @param {string} state
 * @returns {void}
 */
const setLanguage = (req, res, state) => {
  if (req.user && req.user.language) {
    req.setLocale(req.user.language);
  } else if (req.cookies?.lang) {
    req.setLocale(req.cookies?.lang);
  }
  const rtlLanguages = ["ar", "he", "fa", "ur", "yi"];
  const currentLocale = req.getLocale();
  req.isRTL = rtlLanguages.some((lang) => currentLocale.startsWith(lang));
  if (req.user) Object.freeze(req.user);
  set_custom_http_headers(res, req, state);
};

const applyUserLocale = (req, res, next) => {
  if (req.user) {
    if (req.user.language) {
      req.setLocale(req.user.language);
      const rtlLanguages = ["ar", "he", "fa", "ur", "yi"];
      req.isRTL = rtlLanguages.some((lang) =>
        req.user.language.startsWith(lang)
      );
    }
    Object.freeze(req.user);
  }
  next();
};

/**
 * Sets Custom HTTP headers using data from "custom_http_headers" config variable
 * @param {object} res
 * @param {string} state
 * @returns {void}
 */
const set_custom_http_headers = (res, req, state) => {
  const state1 = state || getState();
  const hdrs = state1.getConfig("custom_http_headers");
  if (!req.user) {
    const public_cache_maxage = +state1.getConfig("public_cache_maxage", 0);
    if (public_cache_maxage)
      res.header(
        "Cache-Control",
        `public, max-age=${public_cache_maxage * 60}`
      );
  }
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
 * Validates the raw Host header before any tenant parsing happens.
 * @param {object} req
 * @returns {boolean}
 */
const validateHostAuthority = (req) => {
  const host = req.headers?.["host"];
  if (typeof host !== "string") return false;
  if (host.includes(",") || /\s|\x00/.test(host)) return false;
  const hostname = host.split(":")[0];
  return /^[a-zA-Z0-9._\-[\]]+$/.test(hostname);
};

/**
 * Tries to recognize tenant from HTTP Request
 * @param {object} req
 * @param {number|undefined} hostPartsOffset (optional) for socketIO, to get the tenant with localhost
 * @returns {string}
 */
const get_tenant_from_req = (req, hostPartsOffset) => {
  if (req.subdomains && req.subdomains.length > 0)
    return req.subdomains[req.subdomains.length - 1];

  if (req.subdomains && req.subdomains.length == 0)
    return db.connectObj.default_schema;
  if (!req.subdomains && req.headers.host) {
    if (is_ip_address(req.headers.host.split(":")[0]))
      return db.connectObj.default_schema;
    const parts = req.headers.host.split(".");
    if (parts.length < (!hostPartsOffset ? 3 : 3 - hostPartsOffset))
      return db.connectObj.default_schema;
    else return parts[0];
  }
};

/**
 * middleware to extract the tenant domain and call runWithtenant()
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
const setTenant = (req, res, next) => {
  // Reject malformed authority values before subdomain parsing can switch tenant context.
  if (!validateHostAuthority(req)) {
    res.status(400).json({ error: "Invalid Host header" });
    return;
  }
  // for a saltcorn mobile request use 'req.user.tenant'
  if (req.smr) {
    if (req.user?.tenant && req.user.tenant !== db.connectObj.default_schema) {
      const state = getTenant(req.user.tenant);
      if (!state) {
        setLanguage(req, res);
        next();
      } else {
        db.runWithTenant({ tenant: req.user.tenant, req }, () => {
          setLanguage(req, res, state);
          state.log(5, `${req.method} ${req.originalUrl}`);
          next();
        });
      }
    } else {
      setLanguage(req, res);
      next();
    }
  } else {
    const other_domain = get_other_domain_tenant(req.hostname);
    if (other_domain) {
      const state = getTenant(other_domain);
      if (!state) {
        setLanguage(req, res);
        next();
      } else {
        db.runWithTenant({ tenant: other_domain, req }, () => {
          setLanguage(req, res, state);
          if (state.logLevel >= 5)
            state.log(
              5,
              `${req.method} ${req.originalUrl}${
                state.getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
              }`
            );
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
        db.runWithTenant({ tenant: ten, req }, () => {
          setLanguage(req, res, state);
          if (state.logLevel >= 5)
            state.log(
              5,
              `${req.method} ${req.originalUrl}${
                state.getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
              }`
            );
          next();
        });
      }
    }
  }
};

/**
 * Injects hidden input "_csrf" for CSRF token
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
 * Errors catcher
 * @param {function} fn
 * @returns {function}
 */

// Some query params carry a JSON object/array literal (e.g. _relation_path_)
// that is consumed via JSON.parse rather than reflected into markup. xss()
// leaves quotes intact, so such a literal stays parseable - but we must not
// add the extra attribute-context quote escaping below, which would corrupt it.
const is_json_literal = (s) => {
  const t = s.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return false;
  try {
    const parsed = JSON.parse(t);
    return parsed !== null && typeof parsed === "object";
  } catch {
    return false;
  }
};

const escape_param = (val) => {
  if (Array.isArray(val)) return val.map(escape_param);
  if (val === "__proto__" || val === "constructor") return "";
  if (typeof val === "string")
    return is_json_literal(val)
      ? text(val)
      : // xss() escapes tags but leaves quotes, which allows breaking out
        // of HTML attribute contexts. Also escape quotes so reflected
        // query params are safe in attribute contexts.
        text(val).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  // For object query/param values, recursively escape the values but also drop
  // keys that could become XSS/CSS attribute-name vectors. When an object is
  // passed to a tag helper such as div(x) it is rendered as the element's
  // ATTRIBUTES, turning attacker-controlled keys into attribute names
  // (e.g. ?x[onmouseover]=alert(1)) - an attribute-name injection that value
  // escaping cannot neutralise. So we keep only keys that cannot break out of,
  // or inject into, the attribute context.
  if (val && typeof val === "object") {
    const out = {};
    Object.entries(val).forEach(([k, v]) => {
      if (is_safe_attr_key(k)) out[k] = escape_param(v);
    });
    return out;
  }
  return val;
};

// A query/param object key is only safe if it cannot become a dangerous HTML
// attribute name when the object is reflected as a tag's attributes. We reject:
//  - prototype-pollution keys
//  - event-handler attributes (on*) - the classic XSS vector
//  - the style attribute - a CSS injection vector
//  - any key containing characters that allow breaking out of the attribute
//    name or injecting further attributes (whitespace, quotes, =, <, >, /, etc.)
const is_safe_attr_key = (k) => {
  if (typeof k !== "string") return false;
  if (k === "__proto__" || k === "constructor" || k === "prototype")
    return false;
  if (/^on/i.test(k)) return false;
  if (k.toLowerCase() === "style") return false;
  // only allow conservative attribute-name characters
  return /^[A-Za-z0-9_.:>\-[\]]+$/.test(k);
};

const error_catcher = (fn) => (request, response, next) => {
  //XSS protection.
  // By default, query is not writable in express.
  // https://stackoverflow.com/a/79604142
  Object.defineProperty(request, "query", {
    ...Object.getOwnPropertyDescriptor(request, "query"),
    value: request.query,
    writable: true,
  });

  //escape all query arguments
  Object.entries(request.query || {}).forEach(([nm, val]) => {
    request.query[nm] = escape_param(val);
  });
  //escape all params
  Object.entries(request.params || {}).forEach(([nm, val]) => {
    request.params[nm] = escape_param(val);
  });

  //catch errors
  Promise.resolve(fn(request, response, next)).catch(next);
};

/**
 * Scans for page title from contents
 * @param {string|object} contents
 * @param {string} viewname
 * @returns {string}
 */
const scan_for_page_title = (contents, viewname) => {
  let scanstr = "";
  try {
    scanstr =
      typeof contents === "string" ? contents : JSON.stringify(contents);
  } catch {
    //ignore
  }
  if (scanstr.includes("<!--SCPT:")) {
    const start = scanstr.indexOf("<!--SCPT:");
    const end = scanstr.indexOf("-->", start);
    return scanstr.substring(start + 9, end);
  }

  return viewname;
};

/**
 * Gets gir revision
 * @returns {string}
 */
const getGitRevision = () => db.connectObj.git_commit;

/**
 * Gets session store
 * @returns {session|cookieSession}
 */
const getSessionStore = (pruneInterval) => {
  /*if (getState().getConfig("cookie_sessions", false)) {
    return cookieSession({
      keys: [db.connectObj.session_secret || is.str.generate()],
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "strict",
    });
  } else*/
  if (!db.connectObj.session_secret)
    console.warn(
      "WARNING: Session secret not set, degrading functionality. Set session_secret in the config file"
    );
  let sameSite = getState().getConfig("cookie_samesite", "None").toLowerCase();
  if (sameSite === "unset") sameSite = undefined;
  if (db.isSQLite) {
    var SQLiteStore = require("connect-sqlite3")(session);
    return session({
      store: new SQLiteStore({ db: "sessions.sqlite" }),
      secret: db.connectObj.session_secret || is.str.generate(),
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite, secure: "auto" }, // 30 days
    });
  } else {
    const pgSession = require("connect-pg-simple")(session);
    return session({
      store: new pgSession({
        schemaName: db.connectObj.default_schema,
        pool: db.pool,
        tableName: "_sc_session",
        pruneSessionInterval: pruneInterval > 0 ? pruneInterval : false,
      }),
      secret: db.connectObj.session_secret || is.str.generate(),
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite, secure: "auto" }, // 30 days
    });
  }
};

/**
 * appends 'req.query.on_done_redirect' to 'oldPath' if it exists
 * @param {string} oldPath path without 'on_done_redirect'
 * @param {any} req express request
 * @returns a new string with or without on_done_redirect=...
 */
const addOnDoneRedirect = (oldPath, req) => {
  const separator = oldPath.indexOf("?") > -1 ? "&" : "?";
  if (req.query.on_done_redirect) {
    const encoded = encodeURIComponent(req.query.on_done_redirect);
    return `${oldPath}${separator}on_done_redirect=${encoded}`;
  }
  return oldPath;
};

const safe_redirect = (res, url, default_url) => {
  if (!url) {
    res.redirect(default_url);
    return;
  }
  const dest = normalize_relative_url(url);
  if (dest !== null) res.redirect(dest);
  else res.redirect(default_url);
};

/**
 * Check that String is IPv4 address
 * @param {string} hostname
 * @returns {boolean|string[]}
 */
// TBD not sure that false is correct return if type of is not string
// TBD Add IPv6 support
const is_ip_address = (hostname) => {
  if (typeof hostname !== "string") return false;
  return hostname.split(".").every((s) => +s >= 0 && +s <= 255);
};

const tenant_letsencrypt_name = async (subdomain) => {
  const saneDomain = domain_sanitize(subdomain);
  let altname;
  await db.runWithTenant(saneDomain, async () => {
    altname = getState()
      .getConfig("base_url", "")
      .replace("https://", "")
      .replace("http://", "")
      .replace("/", "");
  });
  return altname;
};

const admin_config_route = ({
  router,
  path,
  super_path = "",
  get_form,
  field_names,
  response,
  flash,
}) => {
  const getTheForm = async (req) =>
    !get_form && field_names
      ? await config_fields_form({
          req,
          field_names,
          action: super_path + path,
        })
      : typeof get_form === "function"
        ? await get_form(req)
        : get_form;

  router.get(
    path,
    isAdmin,
    error_catcher(async (req, res) => {
      response(await getTheForm(req), req, res);
    })
  );
  router.post(
    path,
    isAdmin,
    error_catcher(async (req, res) => {
      const form = await getTheForm(req);
      form.validate(req.body || {});
      if (form.hasErrors) {
        response(form, req, res);
      } else {
        const restart_required = check_if_restart_required(form, req);

        await save_config_from_form(form);
        Trigger.emitEvent("AppChange", `Config`, req.user, {
          config_keys: Object.keys(form.values),
        });
        if (!req.xhr) {
          if (restart_required) {
            flash_restart(req);
          } else req.flash("success", req.__(flash));
          res.redirect(super_path + path);
        } else {
          if (restart_required)
            res.json({
              success: "ok",
              notify:
                req.__("Restart required for changes to take effect.") +
                " " +
                a({ href: "/admin/system" }, req.__("Restart here")),
            });
          else res.json({ success: "ok" });
        }
      }
    })
  );
};

/**
 * Send an HTML string response with injected Saltcorn globals (CSRF token,
 * version tag, locale, page-load tag, admin flag) and normalised static-asset paths.
 * @param {any} req
 * @param {any} res
 * @param {string} html_string
 * @returns
 */
const sendHtmlStringWithGlobals = (req, res, html_string) => {
  res.set("Content-Type", "text/html");
  const state = getState();
  const version_tag = db.connectObj.version_tag;
  const locale = req.getLocale?.();
  const scGlobals =
    `<script>var _sc_globalCsrf = ${JSON.stringify(req.csrfToken())}` +
    `, _sc_version_tag = ${JSON.stringify(version_tag)}` +
    (locale ? `, _sc_locale = ${JSON.stringify(locale)}` : "") +
    `, _sc_pageloadtag = Math.floor(Math.random() * 16777215).toString(16)` +
    (req?.user?.role_id === 1 ? `, _sc_is_admin = true` : "") +
    `;</script>`;
  const normalized = html_string.replace(
    /\/static_assets\/[a-f0-9]+\//g,
    `/static_assets/${version_tag}/`
  );
  const assetBase = `/static_assets/${version_tag}`;

  // CSS and scGlobals go into <head>; scripts go before </body> (after jQuery).
  // Core scripts (dayjs, socket.io) come before plugin scripts from state.headers.
  let headInject = scGlobals;
  if (!normalized.includes("saltcorn.css"))
    headInject += `<link rel="stylesheet" href="${assetBase}/saltcorn.css">`;
  if (!normalized.includes("saltcorn.js"))
    headInject += `<script src="${assetBase}/saltcorn.js"></script>`;

  let bodyInject = "";
  for (const fname of ["dayjs.min.js", "socket.io.min.js"]) {
    if (!normalized.includes(fname))
      bodyInject += `<script src="${assetBase}/${fname}"></script>`;
  }
  if (locale && !normalized.includes(`dayjslocales/${locale}.js`))
    bodyInject += `<script src="${assetBase}/dayjslocales/${locale}.js"></script>`;
  if (!normalized.includes("dynamic_updates_cfg")) {
    const dynamic_updates_enabled = state.getConfig(
      "enable_dynamic_updates",
      false
    );
    bodyInject += `<script>var dynamic_updates_cfg = ${JSON.stringify({ enabled: dynamic_updates_enabled })};</script>`;
  }

  const stateHeaders = Array.isArray(state.headers)
    ? state.headers
    : Object.values(state.headers || {}).flat();
  for (const h of stateHeaders) {
    if (h.css && !normalized.includes(h.css))
      headInject += `<link rel="stylesheet" href="${h.css}">`;
    else if (h.script && !normalized.includes(h.script))
      bodyInject += `<script src="${h.script}"></script>`;
  }

  let html = normalized.includes("</head>")
    ? normalized.replace("</head>", `${headInject}</head>`)
    : headInject + normalized;
  if (bodyInject)
    html = html.includes("</body>")
      ? html.replace("</body>", `${bodyInject}</body>`)
      : html + bodyInject;
  return res.send(html);
};

/**
 * Send HTML file to client without any menu
 * @param {any} req
 * @param {any} res
 * @param {string} file
 * @returns
 */
const sendHtmlFile = async (req, res, file) => {
  const fullPath = path.join((await File.rootFolder()).location, file);
  const role = req.user && req.user.id ? req.user.role_id : 100;
  try {
    const scFile = await File.from_file_on_disk(
      path.basename(fullPath),
      path.dirname(fullPath)
    );
    if (scFile && role <= scFile.min_role_read) {
      res.sendFile(fullPath, { dotfiles: "allow" });
    } else {
      return res
        .status(404)
        .sendWrap(req.__("An error occurred"), req.__("File not found"));
    }
  } catch (e) {
    console.error(e);
    return res
      .status(404)
      .sendWrap(
        req.__("An error occurred"),
        e.message || req.__("An error occurred")
      );
  }
};

/**
 * set the minimum role for a model (Page, View, ...)
 * @param {any} req
 * @param {any} res
 * @param {any} model
 */
const setRole = async (req, res, model) => {
  const { id } = req.params;
  const role = (req.body || {}).role;
  await model.update(+id, { min_role: role });
  const page = model.findOne({ id });
  const roles = await User.get_roles();
  const roleRow = roles.find((r) => r.id === +role);
  const message =
    roleRow && page
      ? req.__(`Minimum role for %s updated to %s`, page.name, roleRow.role)
      : req.__(`Minimum role updated`);
  if (model.state_refresh) await model.state_refresh();
  if (!req.xhr) {
    req.flash("success", message);
    res.redirect("/pageedit");
  } else res.json({ okay: true, responseText: message });
};

/**
 * internal helper to get the device type from user agent
 * @param {any} req
 * @returns device type as string
 */
const uaDevice = (req) => {
  const uaParser = new UAParser(req.headers["user-agent"]);
  const device = uaParser.getDevice();
  if (!device.type) return "web";
  else return device.type;
};

/**
 * internal helper to get the device specific screen info from config
 * @param {any} req
 * @returns object with device type and screen info
 */
const screenInfoFromCfg = (req) => {
  const device = uaDevice(req);
  const uaScreenInfos = getState().getConfig("user_agent_screen_infos", {});
  return { device, ...uaScreenInfos[device] };
};

/**
 * get the eligible page for pagegroup with respect to the screen infos
 * @param {PageGroup} pageGroup
 * @param {any} req
 * @param {any} res
 * @returns eligible page an error message or an object with reload flag
 */
const getEligiblePage = async (pageGroup, req, res) => {
  if (pageGroup.members.length === 0)
    return req.__("Pagegroup %s has no members", pageGroup.name);
  else {
    let screenInfos = null;
    if (req.cookies["_sc_screen_info_"]) {
      screenInfos = JSON.parse(req.cookies["_sc_screen_info_"]);
      screenInfos.device = uaDevice(req);
    } else {
      const strategy = getState().getConfig(
        "missing_screen_info_strategy",
        "guess_from_user_agent"
      );
      if (strategy === "guess_from_user_agent")
        screenInfos = screenInfoFromCfg(req);
      else if (strategy === "reload" && req.query.is_reload !== "true") {
        res.sendWrap(
          script(
            domReady(`
            setScreenInfoCookie();
            window.location = updateQueryStringParameter(window.location.href, "is_reload", true);`)
          )
        );
        return { isReload: true };
      }
    }
    return await pageGroup.getEligiblePage(
      screenInfos,
      req.user ? req.user : { role_id: features.public_user_role },
      req.getLocale()
    );
  }
};

/**
 * @param {PageGroup} pageGroup
 * @param {any} req
 * @returns the page, null or an error msg
 */
const getRandomPage = (pageGroup, req) => {
  if (pageGroup.members.length === 0)
    return req.__("Pagegroup %s has no members", pageGroup.name);
  const hash = crypto.createHash("sha1").update(req.sessionID).digest("hex");
  const idx =
    parseInt(hash.substring(hash.length - 4), 16) % pageGroup.members.length;
  const sessionMember = pageGroup.members[idx];
  return Page.findOne({ id: sessionMember.page_id });
};

const checkEditPermission = (type, user) => {
  if (user.role_id === 1) return true;
  switch (type) {
    case "views":
      return getState().getConfig("min_role_edit_views", 1) >= user.role_id;
    case "pages":
      return getState().getConfig("min_role_edit_pages", 1) >= user.role_id;
    case "triggers":
      return getState().getConfig("min_role_edit_triggers", 1) >= user.role_id;
    default:
      return false;
  }
};

module.exports = {
  sqlsanitize,
  csrfField,
  loggedIn,
  isAdmin,
  isAdminOrHasConfigMinRole,
  rejectTenantDrift,
  get_base_url,
  error_catcher,
  scan_for_page_title,
  getGitRevision,
  getSessionStore,
  validateHostAuthority,
  applyUserLocale,
  setTenant,
  get_tenant_from_req,
  addOnDoneRedirect,
  is_relative_url,
  normalize_relative_url,
  safe_redirect,
  is_ip_address,
  get_sys_info,
  admin_config_route,
  sendHtmlFile,
  sendHtmlStringWithGlobals,
  setRole,
  getEligiblePage,
  getRandomPage,
  tenant_letsencrypt_name,
  checkEditPermission,
};
