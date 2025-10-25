/**
 * Saltcorn App
 * @category server
 * @module app
 */

const express = require("express");
const mountRoutes = require("./routes");

const {
  getState,
  getRootState,
  init_multi_tenant,
} = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const passport = require("passport");
const CustomStrategy = require("passport-custom").Strategy;
const BearerStrategy = require("passport-http-bearer");
const User = require("@saltcorn/data/models/user");
const File = require("@saltcorn/data/models/file");
const flash = require("connect-flash");
const { loadAllPlugins } = require("./load_plugins");
const homepage = require("./routes/homepage");
const errors = require("./errors");
const {
  getConfig,
  available_languages,
} = require("@saltcorn/data/models/config");
const {
  get_base_url,
  error_catcher,
  getSessionStore,
  setTenant,
} = require("./routes/utils.js");
const {
  getAllTenants,
  eachTenant,
} = require("@saltcorn/admin-models/models/tenant");
const path = require("path");
const helmet = require("helmet");
const wrapper = require("./wrapper");
const csrf = require("@dr.pogodin/csurf");
const { I18n } = require("i18n");
const { h1 } = require("@saltcorn/markup/tags");
const is = require("contractis/is");
const Trigger = require("@saltcorn/data/models/trigger");
const s3storage = require("./s3storage");
const TotpStrategy = require("passport-totp").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const cors = require("cors");
const api = require("./routes/api");
const scapi = require("./routes/scapi");
const fs = require("fs");
const PluginRoutesHandler = require("./plugin_routes_handler");
const compression = require("compression");

const locales = Object.keys(available_languages);
// jwt config
const jwt_secret = db.connectObj.jwt_secret;
const jwt_extractor = ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderWithScheme("jwt"),
  ExtractJwt.fromUrlQueryParameter("jwt"),
]);
const jwtOpts = {
  jwtFromRequest: jwt_extractor,
  secretOrKey: jwt_secret,
  issuer: "saltcorn@saltcorn",
  audience: "saltcorn-mobile-app",
};

const disabledCsurf = (req, res, next) => {
  req.csrfToken = () => "";
  next();
};

const noCsrfLookup = (state, pluginRoutesHandler) => {
  const disable_csrf_routes = state.getConfig("disable_csrf_routes", "");
  const result = new Set(
    disable_csrf_routes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  for (const url of pluginRoutesHandler.noCsrfUrls) {
    result.add(url);
  }
  return result;
};

// todo console.log app instance info when app stxarts - avoid to show secrets (password, etc)

/**
 * @param {object} [opts = {}]
 * @returns {Promise<Express>}
 */
const getApp = async (opts = {}) => {
  const app = express();
  let sql_log = await getConfig("log_sql");

  // switch on sql logging
  if (sql_log) db.set_sql_logging(); // dont override cli flag
  // load all plugins
  await loadAllPlugins();
  // get development mode status
  const development_mode = getState().getConfig("development_mode", false);
  // switch on sql logging - but it was initiated before???
  if (getState().getConfig("log_sql", false)) db.set_sql_logging();
  // for multi-tenant with localhost, we need 1 instead of the default of 2
  if (opts.subdomainOffset) app.set("subdomain offset", opts.subdomainOffset);

  // https://www.npmjs.com/package/helmet
  // helmet is secure app by adding HTTP headers

  const cross_domain_iframe = getState().getConfig(
    "cross_domain_iframe",
    false
  );
  app.set("query parser", "extended");

  const helmetOptions = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "script-src-attr": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: [
          "'self'",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
          "'unsafe-inline'",
        ],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        "form-action": ["'self'", "javascript:"],
      },
    },
    referrerPolicy: {
      policy: ["same-origin"],
    },
  };
  if (
    getState().getConfig("content_security_policy", "Disabled") === "Disabled"
  )
    helmetOptions.contentSecurityPolicy = false;

  if (cross_domain_iframe) helmetOptions.xFrameOptions = false;
  app.use(helmet(helmetOptions));
  app.use(compression());
  // TODO ch find a better solution
  if (getState().getConfig("cors_enabled", true)) app.use(cors());
  const bodyLimit = getState().getConfig("body_limit");
  app.use(
    express.json({
      limit: bodyLimit ? `${bodyLimit}kb` : "5mb",
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  const urlencodedLimit = getState().getConfig("url_encoded_limit");
  // extended url encoding in use
  app.use(
    express.urlencoded({
      limit: urlencodedLimit ? `${urlencodedLimit}kb` : "5mb",
      extended: true,
      parameterLimit: 50000,
    })
  );

  // cookies
  app.use(require("cookie-parser")());

  // i18n configuration

  let i18n;

  if (getState().getConfig("development_mode")) {
    // i18n configuration
    i18n = new I18n({
      locales,
      directory: path.join(__dirname, "locales"),
      mustacheConfig: { disable: true },
      defaultLocale: getState().getConfig("default_locale"),
    });
  } else {
    const staticCatalog = {};
    for (const locale of locales) {
      staticCatalog[locale] = require(`./locales/${locale}.json`);
    }

    for (const [nm, loc] of Object.entries(getState().plugin_locations))
      if (fs.existsSync(path.join(loc, "locales")))
        for (const locale of locales)
          if (fs.existsSync(path.join(loc, "locales", `${locale}.json`))) {
            const xlations = JSON.parse(
              fs.readFileSync(path.join(loc, "locales", `${locale}.json`))
            );
            Object.assign(staticCatalog[locale], xlations);
          }

    i18n = new I18n({
      locales,
      staticCatalog,
      mustacheConfig: { disable: true },
      defaultLocale: getState().getConfig("default_locale"),
    });
  }

  // i18n support
  app.use(i18n.init);
  // init multitenant mode
  if (db.is_it_multi_tenant()) {
    const tenants = await getAllTenants();
    await init_multi_tenant(loadAllPlugins, opts.disableMigrate, tenants);
  }
  const pruneSessionInterval = +getState().getConfig(
    "prune_session_interval",
    900
  );
  //
  // todo ability to configure session_secret Age
  app.use(getSessionStore(pruneSessionInterval));

  app.use(passport.initialize());
  app.use(passport.authenticate(["jwt", "session"]));
  const isPlaywright = process.env.SALTCORN_SERVE_MOBILE_TEST_BUILD?.length > 0;
  app.use((req, res, next) => {
    // no jwt and session id at the same time
    if (
      !(jwt_extractor(req) && req.cookies && req.cookies["connect.sid"]) ||
      isPlaywright
    )
      next();
  });
  app.use(flash());

  //static serving

  //legacy
  app.use(
    express.static(__dirname + "/public", {
      maxAge: 1000 * 60 * 60 * 24,
    })
  );
  app.use(
    express.static(
      path.dirname(require.resolve("@saltcorn/builder/package.json")) + "/dist",
      {
        maxAge: 1000 * 60 * 60 * 24,
      }
    )
  );

  if (process.env.SALTCORN_SERVE_ADDITIONAL_DIR)
    app.use(
      express.static(process.env.SALTCORN_SERVE_ADDITIONAL_DIR, {
        maxAge: 1000 * 60 * 60 * 24,
      })
    );
  let version_tag = db.connectObj.version_tag;

  if (process.env.SALTCORN_SERVE_MOBILE_TEST_BUILD) {
    app.use(
      "/mobile_test_build",
      express.static(process.env.SALTCORN_SERVE_MOBILE_TEST_BUILD, {
        maxAge: "100d",
      })
    );
  }

  app.use(
    `/static_assets/${version_tag}`,
    express.static(__dirname + "/public", {
      maxAge: "100d",
    })
  );
  app.use(
    `/static_assets/${version_tag}`,
    express.static(
      path.dirname(require.resolve("@saltcorn/builder/package.json")) + "/dist",
      {
        maxAge: "100d",
      }
    )
  );
  app.use(
    `/static_assets/${version_tag}`,
    express.static(
      path.dirname(require.resolve("@saltcorn/filemanager/package.json")) +
        "/public/build",
      {
        maxAge: "100d",
      }
    )
  );

  passport.use(
    "local",
    new CustomStrategy((req, done) => {
      loginAttempt();
      async function loginAttempt() {
        const { remember, _csrf, dest, ...userobj } = req.body || {};
        if (!is.objVals(is.str).check(userobj))
          return done(
            null,
            false,
            req.flash("danger", req.__("Incorrect user or password"))
          );
        const mu = await User.authenticate(userobj);
        if (mu && mu._attributes.totp_enabled)
          return done(null, { pending_user: mu.session_object });
        else if (mu) return done(null, mu.session_object);
        else {
          const { password, ...nopw } = userobj;
          Trigger.emitEvent("LoginFailed", null, null, nopw);
          return done(
            null,
            false,
            req.flash("danger", req.__("Incorrect user or password"))
          );
        }
      }
    })
  );
  for (const [nm, auth] of Object.entries(getState().auth_methods)) {
    passport.use(nm, auth.strategy);
  }
  passport.use(
    "api-bearer",
    new BearerStrategy(function (token, done) {
      loginAttempt();
      async function loginAttempt() {
        const mu = (await User.findByApiToken(token)) || (await User.findOne({ api_token: token }));
        if (mu && token && token.length > 5)
          return done(
            null,
            {
              email: mu.email,
              id: mu.id,
              role_id: mu.role_id,
              language: mu.language,
              tenant: db.getTenantSchema(),
            },
            { scope: "all" }
          );
        else {
          return done(null, { role_id: 100 });
        }
      }
    })
  );
  passport.use(
    new JwtStrategy(jwtOpts, async (jwt_payload, done) => {
      const userCheck = async () => {
        const u = await User.findOne({ email: jwt_payload.sub });
        if (
          u &&
          u.last_mobile_login &&
          (typeof u.last_mobile_login === "string"
            ? new Date(u.last_mobile_login).valueOf()
            : u.last_mobile_login) <= jwt_payload.iat
        ) {
          return done(null, u.session_object);
        } else {
          return done(null, { role_id: 100 });
        }
      };
      if (
        db.is_it_multi_tenant() &&
        jwt_payload.tenant?.length > 0 &&
        jwt_payload.tenant !== db.connectObj.default_schema
      ) {
        return await db.runWithTenant(jwt_payload.tenant, userCheck);
      } else {
        return await userCheck();
      }
    })
  );
  passport.use(
    new TotpStrategy(function (user, done) {
      // setup function, supply key and period to done callback
      User.findOne({ id: user.pending_user.id }).then((u) => {
        return done(null, u._attributes.totp_key, 30);
      });
    })
  );
  passport.serializeUser(function (user, done) {
    done(null, user);
  });
  passport.deserializeUser(function (user, done) {
    done(null, user);
  });
  app.use(function (req, res, next) {
    if (req.headers["x-saltcorn-client"] === "mobile-app") {
      req.smr = true; // saltcorn-mobile-request
    }
    if (req.headers["x-saltcorn-client"] === "react-view") {
      req.rvr = true; // react-view-request
    }
    return next();
  });
  app.use(setTenant);

  // Change into s3storage compatible selector
  // existing fileupload middleware is moved into s3storage.js
  app.use(s3storage.middlewareSelect);
  app.use(s3storage.middlewareTransform);

  app.use(wrapper(version_tag));

  app.use("/api", api);
  app.use("/scapi", scapi);

  const pluginRoutesHandler = new PluginRoutesHandler();
  await eachTenant(async () => {
    pluginRoutesHandler.initTenantRouter(
      db.getTenantSchema(),
      getState().plugin_routes || {}
    );
    getState().routesChangedCb = () => {
      pluginRoutesHandler.initTenantRouter(
        db.getTenantSchema(),
        getState().plugin_routes || {}
      );
      noCsrf = noCsrfLookup(getRootState(), pluginRoutesHandler);
    };
  });

  const csurf = csrf();
  let noCsrf = null;
  if (!opts.disableCsrf) {
    noCsrf = noCsrfLookup(getState(), pluginRoutesHandler);
    app.use(function (req, res, next) {
      if (
        [...(noCsrf || [])].some((url_prefix) =>
          req.url.startsWith(url_prefix)
        ) ||
        (req.smr &&
          (req.url.startsWith("/api/") ||
            req.url === "/auth/login-with/jwt" ||
            req.url === "/auth/signup")) ||
        jwt_extractor(req) ||
        req.url === "/auth/callback/saml" ||
        req.url.startsWith("/notifications/share-handler") ||
        req.url.startsWith("/notifications/manifest")
      )
        return disabledCsurf(req, res, next);
      csurf(req, res, next);
    });
  } else app.use(disabledCsurf);

  mountRoutes(app);
  // set tenant homepage as / root
  app.get("/", error_catcher(homepage));

  app.use((req, res, next) => {
    const tenant = db.getTenantSchema();
    if (!pluginRoutesHandler.tenantRouters[tenant]) {
      // if tenant router is not initialized, try to initialize it
      pluginRoutesHandler.initTenantRouter(
        tenant,
        getState().plugin_routes || {}
      );
      getState().routesChangedCb = () => {
        pluginRoutesHandler.initTenantRouter(
          tenant,
          getState().plugin_routes || {}
        );
        noCsrf = noCsrfLookup(getRootState(), pluginRoutesHandler);
      };
    }
    if (pluginRoutesHandler.tenantRouters[tenant])
      pluginRoutesHandler.tenantRouters[tenant](req, res, next);
    else next();
  });
  // /robots.txt
  app.get(
    "/robots.txt",
    error_catcher(async (req, res) => {
      const base = get_base_url(req);
      res.set("Content-Type", "text/plain");
      res.send(`User-agent: * 
Allow: /
Sitemap: ${base}sitemap.xml
`);
    })
  );
  // /sitemap.xml
  app.get(
    "/sitemap.xml",
    error_catcher(async (req, res) => {
      const base = get_base_url(req);
      res.set("Content-Type", "text/xml");
      //everything in menu with public access, link to here
      const cfg = getState().getConfig("menu_items", []);
      const urls = [base];
      const loop_menu = (items) => {
        for (const item of items)
          if (+item.min_role === 100 || item.subitems) {
            if (item.type === "Page")
              urls.push(`${base}page/${encodeURIComponent(item.pagename)}`);
            if (item.type === "View")
              urls.push(`${base}view/${encodeURIComponent(item.viewname)}`);
            if (item.subitems) loop_menu(item.subitems);
          }
      };
      loop_menu(cfg);
      const now = new Date().toISOString();
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <urlset
          xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls
      .map(
        (url) => `<url>
      <loc>${url}</loc>
      <lastmod>${now}</lastmod>      
    </url>`
      )
      .join("")}
    
    </urlset>`);
    })
  );
  if (!opts.disableCatch) app.use(errors);

  // file store ensure
  await File.ensure_file_store();
  // 404 handling
  app.get("*any", function (req, res) {
    res.status(404).sendWrap(req.__("Not found"), h1(req.__("Page not found")));
  });

  //prevent prototype pollution
  delete Object.prototype.__proto__;
  return app;
};
module.exports = getApp;
