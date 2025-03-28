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
const { hash } = require("@saltcorn/data/utils");
const { input, script, domReady, a } = require("@saltcorn/markup/tags");
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
  if (req.user && req.user.id && req.user.tenant === db.getTenantSchema()) {
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
  if (req.user && req.user.role_id === 1 && req.user.tenant === cur_tenant) {
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
  if (req.user) Object.freeze(req.user);
  set_custom_http_headers(res, req, state);
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
const error_catcher = (fn) => (request, response, next) => {
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
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite }, // 30 days
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
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite }, // 30 days
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
    return `${oldPath}${separator}on_done_redirect=${req.query.on_done_redirect}`;
  }
  return oldPath;
};

//https://stackoverflow.com/a/38979205/19839414
const is_relative_url = (url) => {
  return typeof url === "string" && !url.includes(":/") && !url.includes("//");
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
  get_base_url,
  error_catcher,
  scan_for_page_title,
  getGitRevision,
  getSessionStore,
  setTenant,
  get_tenant_from_req,
  addOnDoneRedirect,
  is_relative_url,
  is_ip_address,
  get_sys_info,
  admin_config_route,
  sendHtmlFile,
  setRole,
  getEligiblePage,
  getRandomPage,
  tenant_letsencrypt_name,
  checkEditPermission,
};
