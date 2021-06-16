/**
 * Saltcorn App
 */

const express = require("express");
const mountRoutes = require("./routes");

const { getState, init_multi_tenant } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const passport = require("passport");
const CustomStrategy = require("passport-custom").Strategy;
const BearerStrategy = require("passport-http-bearer");
const session = require("express-session");
const cookieSession = require("cookie-session");
const User = require("@saltcorn/data/models/user");
const File = require("@saltcorn/data/models/file");
const flash = require("connect-flash");
const { loadAllPlugins } = require("./load_plugins");
const { migrate } = require("@saltcorn/data/migrate");
const homepage = require("./routes/homepage");
const errors = require("./errors");
const {
  getConfig,
  available_languages,
} = require("@saltcorn/data/models/config");
const { setTenant, get_base_url, error_catcher } = require("./routes/utils.js");
const path = require("path");
const fileUpload = require("express-fileupload");
const helmet = require("helmet");
const wrapper = require("./wrapper");
const csrf = require("csurf");
const { I18n } = require("i18n");
const { h1 } = require("@saltcorn/markup/tags");
const is = require("contractis/is");

const locales = Object.keys(available_languages);
// i18n configuration
const i18n = new I18n({
  locales,
  directory: path.join(__dirname, "locales"),
});
// todo console.log app instance info when app starts - avoid to show secrets (password, etc)
const getApp = async (opts = {}) => {
  const app = express();
  let sql_log;
  try {
    sql_log = await getConfig("log_sql");
  } catch (e) {
    const msg = e.message;
    if (msg && msg.includes("_sc_config"))
      console.error(
        "Database is reachable but not initialised. Please run 'saltcorn reset-schema' or 'saltcorn add-schema'"
      );
    else {
      console.error("Database is not reachable. The error was: ", msg);
      console.error("Connection parameters tried: ");
      console.error(db.connectObj);
    }
    process.exit(1);
  }
  // switch on sql logging
  if (sql_log) db.set_sql_logging(); // dont override cli flag
// migrate database
  if (!opts.disableMigrate) await migrate();
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
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  // extenetede url encoding in use
  app.use(express.urlencoded({ extended: true }));

  // add fileupload feature
  // todo ability to configure filetmp dir - add new config / env parameter
  app.use(
    fileUpload({
      useTempFiles: true,
      createParentPath: true,
      tempFileDir: "/tmp/",
    })
  );
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
  if (getState().getConfig("cookie_sessions", false)) {
    app.use(
      cookieSession({
        keys: [db.connectObj.session_secret || is.str.generate()],
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "strict",
      })
    );
  } else if (db.isSQLite) { // todo database specific
    var SQLiteStore = require("connect-sqlite3")(session);
    app.use(
      session({
        store: new SQLiteStore({ db: "sessions.sqlite" }),
        secret: db.connectObj.session_secret || is.str.generate(),
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "strict" }, // 30 days
      })
    );
  } else { // todo database specific
    const pgSession = require("connect-pg-simple")(session);

    app.use(
      session({
        store: new pgSession({
          schemaName: db.connectObj.default_schema,
          pool: db.pool,
          tableName: "_sc_session",
        }),
        secret: db.connectObj.session_secret || is.str.generate(),
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
      })
    );
  }
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
  app.get("/", setTenant, error_catcher(homepage));
  // /robots.txt
  app.get(
    "/robots.txt",
    setTenant,
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
    setTenant,
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
