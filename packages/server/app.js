/**
 * Saltcorn App
 * @category server
 * @module app
 */

const express = require("express");
const mountRoutes = require("./routes");

const { getState, init_multi_tenant } = require("@saltcorn/data/db/state");
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
const path = require("path");
const fileUpload = require("express-fileupload");
const helmet = require("helmet");
const wrapper = require("./wrapper");
const csrf = require("csurf");
const { I18n } = require("i18n");
const { h1 } = require("@saltcorn/markup/tags");
const is = require("contractis/is");
const Trigger = require("@saltcorn/data/models/trigger");
const s3storage = require("./s3storage");

const locales = Object.keys(available_languages);
// i18n configuration
const i18n = new I18n({
  locales,
  directory: path.join(__dirname, "locales"),
});
// todo console.log app instance info when app starts - avoid to show secrets (password, etc)

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

  // https://www.npmjs.com/package/helmet
  // helmet is secure app by adding HTTP headers
  app.use(helmet());
  app.use(
    express.json({
      limit: "5mb",
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  // extenetede url encoding in use
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // cookies
  app.use(require("cookie-parser")());
  // i18n support
  app.use(i18n.init);
  // init multitenant mode
  if (db.is_it_multi_tenant()) {
    await init_multi_tenant(loadAllPlugins, opts.disableMigrate);
  }
  //
  // todo ability to configure session_secret Age
  app.use(getSessionStore());

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

  //static serving

  //legacy
  app.use(
    express.static(__dirname + "/public", {
      maxAge: development_mode ? 0 : 1000 * 60 * 15,
    })
  );
  app.use(
    express.static(
      path.dirname(require.resolve("@saltcorn/builder/package.json")) + "/dist",
      {
        maxAge: development_mode ? 0 : 1000 * 60 * 30,
      }
    )
  );

  if (process.env.SALTCORN_SERVE_ADDITIONAL_DIR)
    app.use(
      express.static(process.env.SALTCORN_SERVE_ADDITIONAL_DIR, {
        maxAge: development_mode ? 0 : 1000 * 60 * 15,
      })
    );
  let version_tag = db.connectObj.version_tag;

  app.use(
    `/static_assets/${version_tag}`,
    express.static(__dirname + "/public", {
      maxAge: development_mode ? 0 : "100d",
    })
  );
  app.use(
    `/static_assets/${version_tag}`,
    express.static(
      path.dirname(require.resolve("@saltcorn/builder/package.json")) + "/dist",
      {
        maxAge: development_mode ? 0 : "100d",
      }
    )
  );

  passport.use(
    "local",
    new CustomStrategy((req, done) => {
      loginAttempt();
      async function loginAttempt() {
        const { remember, _csrf, ...userobj } = req.body;
        if (!is.objVals(is.str).check(userobj))
          return done(
            null,
            false,
            req.flash("danger", req.__("Incorrect user or password"))
          );
        const mu = await User.authenticate(userobj);
        if (mu) return done(null, mu.session_object);
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
        const mu = await User.findOne({ api_token: token });
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
          return done(null, { role_id: 10 });
        }
      }
    })
  );
  passport.serializeUser(function (user, done) {
    done(null, user);
  });
  passport.deserializeUser(function (user, done) {
    done(null, user);
  });
  app.use(setTenant);

  // Change into s3storage compatible selector
  // existing fileupload middleware is moved into s3storage.js
  app.use(s3storage.middlewareSelect);
  app.use(s3storage.middlewareTransform);

  app.use(wrapper(version_tag));
  const csurf = csrf();
  if (!opts.disableCsrf)
    app.use(function (req, res, next) {
      if (req.url.startsWith("/api/")) return next();
      csurf(req, res, next);
    });
  else
    app.use((req, res, next) => {
      req.csrfToken = () => "";
      next();
    });

  mountRoutes(app);
  // set tenant homepage as / root
  app.get("/", error_catcher(homepage));
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
          if (+item.min_role === 10 || item.subitems) {
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
  app.get("*", function (req, res) {
    res.status(404).sendWrap(req.__("Not found"), h1(req.__("Page not found")));
  });
  return app;
};
module.exports = getApp;
