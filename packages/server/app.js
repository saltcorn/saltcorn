const express = require("express");
const mountRoutes = require("./routes");

const { getState, init_multi_tenant } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const BearerStrategy = require("passport-http-bearer");
const session = require("express-session");
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

const i18n = new I18n({
  locales,
  directory: path.join(__dirname, "locales"),
});

const getApp = async (opts = {}) => {
  const app = express();
  const sql_log = await getConfig("log_sql");
  const development_mode = await getConfig("development_mode", false);
  if (sql_log) db.set_sql_logging(); // dont override cli flag
  if (!opts.disableMigrate) await migrate();

  await loadAllPlugins();

  app.use(helmet());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(
    fileUpload({
      useTempFiles: true,
      createParentPath: true,
      tempFileDir: "/tmp/",
    })
  );
  app.use(require("cookie-parser")());
  app.use(i18n.init);

  if (db.is_it_multi_tenant()) {
    await init_multi_tenant(loadAllPlugins, opts.disableMigrate);
  }
  if (db.isSQLite) {
    var SQLiteStore = require("connect-sqlite3")(session);
    app.use(
      session({
        store: new SQLiteStore({ db: "sessions.sqlite" }),
        secret: db.connectObj.session_secret || "tja3j675m5wsjj65",
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "strict" }, // 30 days
      })
    );
  } else {
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

  passport.use(
    "local",
    new LocalStrategy(
      { passReqToCallback: true, usernameField: "email" },
      (req, email, password, done) => {
        loginAttempt();
        async function loginAttempt() {
          const mu = await User.authenticate({ email, password });
          if (mu) return done(null, mu.session_object);
          else {
            return done(
              null,
              false,
              req.flash("danger", req.__("Incorrect user or password"))
            );
          }
        }
      }
    )
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

  app.use(wrapper);
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

  app.get("/", setTenant, error_catcher(homepage));

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
  app.get(
    "/sitemap.xml",
    setTenant,
    error_catcher(async (req, res) => {
      const base = get_base_url(req);
      res.set("Content-Type", "text/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <urlset
          xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>${base}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <priority>1.00</priority>
    </url>
    </urlset>`);
    })
  );
  if (!opts.disableCatch) app.use(errors);

  await File.ensure_file_store();

  app.get("*", function (req, res) {
    res.status(404).sendWrap(res.__("Not found"), h1(res.__("Page not found")));
  });
  return app;
};
module.exports = getApp;
