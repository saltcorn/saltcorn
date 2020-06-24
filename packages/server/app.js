const express = require("express");
const mountRoutes = require("./routes");

const { getState, init_multi_tenant } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const User = require("@saltcorn/data/models/user");
const flash = require("connect-flash");
const { loadAllPlugins } = require("./load_plugins");
const { migrate } = require("@saltcorn/data/migrate");
const homepage = require("./routes/homepage");
const errors = require("./errors");
const { getConfig } = require("@saltcorn/data/models/config");
const { setTenant, get_base_url, error_catcher } = require("./routes/utils.js");
const path = require("path");
const fileUpload = require("express-fileupload");
const helmet = require("helmet");
const wrapper = require("./wrapper");
const csrf = require("csurf");

const getApp = async (opts = {}) => {
  const app = express();
  const sql_log = await getConfig("log_sql");
  const development_mode = await getConfig("development_mode", false);
  if (sql_log) db.set_sql_logging(); // dont override cli flag
  await migrate();

  await loadAllPlugins();

  app.use(helmet());

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(
    fileUpload({
      useTempFiles: true,
      createParentPath: true,
      tempFileDir: "/tmp/"
    })
  );
  app.use(require("cookie-parser")());

  if (db.is_it_multi_tenant()) {
    await init_multi_tenant(loadAllPlugins);
  }
  app.use(
    session({
      store: new pgSession({
        pool: db.pool,
        tableName: "_sc_session"
      }),
      secret: db.connectObj.session_secret || "tja3j675m5wsjj65",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "strict" } // 30 days
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());
  app.use(
    express.static(__dirname + "/public", {
      maxAge: development_mode ? 0 : 1000 * 60 * 15
    })
  );
  app.use(
    express.static(
      path.dirname(require.resolve("@saltcorn/builder/package.json")) + "/dist",
      {
        maxAge: development_mode ? 0 : 1000 * 60 * 30
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
          if (mu)
            return done(null, {
              email: mu.email,
              id: mu.id,
              role_id: mu.role_id,
              tenant: db.getTenantSchema()
            });
          else {
            return done(
              null,
              false,
              req.flash("danger", "Incorrect user or password")
            );
          }
        }
      }
    )
  );
  passport.serializeUser(function(user, done) {
    done(null, user);
  });
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  app.use(wrapper);
  if (!opts.disableCsrf) app.use(csrf());
  else
    app.use((req, res, next) => {
      req.csrfToken = () => "";
      next();
    });

  mountRoutes(app);

  app.get("/", setTenant, error_catcher(homepage));

  app.get("/robots.txt", setTenant, error_catcher(async (req, res) => {
    const base = get_base_url(req);
    res.set("Content-Type", "text/plain");
    res.send(`User-agent: * 
Allow: /
Sitemap: ${base}sitemap.xml
`);
  }));
  app.get("/sitemap.xml", setTenant, error_catcher(async (req, res) => {
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
  }));
  if (!opts.disableCatch) app.use(errors);
  return app;
};
module.exports = getApp;
