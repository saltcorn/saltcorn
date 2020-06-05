const express = require("express");
const mountRoutes = require("./routes");
const { ul, li, div, small } = require("@saltcorn/markup/tags");

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
const { setTenant } = require("./routes/utils.js");
const path = require("path");
const fileUpload = require("express-fileupload");

const getApp = async () => {
  const app = express();
  const sql_log = await getConfig("log_sql");
  if (sql_log) db.set_sql_logging(); // dont override cli flag
  await migrate();

  await loadAllPlugins();

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
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());
  app.use(
    express.static(__dirname + "/public", {
      maxAge: 0 //1000 * 60 * 60 * 24
    })
  );
  app.use(
    express.static(
      path.dirname(require.resolve("@saltcorn/builder/package.json")) + "/dist",
      {
        maxAge: 0 //1000 * 60 * 60 * 24
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

  const getFlashes = req =>
    ["error", "success", "danger", "warning"]
      .map(type => {
        return { type, msg: req.flash(type) };
      })
      .filter(a => a.msg && a.msg.length && a.msg.length > 0);
  const get_extra_menu = () => {
    const cfg = getState().getConfig("extra_menu");
    const items = cfg.split(",");
    return items.map(item => {
      const [nm, url] = item.split("::");
      return { link: url, label: nm };
    });
  };
  app.use(function(req, res, next) {
    res.sendWrap = function(title, ...html) {
      const isAuth = req.isAuthenticated();
      const allow_signup = getState().getConfig("allow_signup");
      const login_menu = getState().getConfig("login_menu");
      const extra_menu = get_extra_menu();
      const views = getState()
        .views.filter(v => v.on_menu && (isAuth || v.is_public))
        .map(v => ({ link: `/view/${v.name}`, label: v.name }));
      const authItems = isAuth
        ? [
            { label: small(req.user.email.split("@")[0]) },
            { link: "/auth/logout", label: "Logout" }
          ]
        : [
            ...(allow_signup
              ? [{ link: "/auth/signup", label: "Sign up" }]
              : []),
            ...(login_menu ? [{ link: "/auth/login", label: "Login" }] : [])
          ];
      const schema =db.getTenantSchema() 
      const tenant_list =
        db.is_it_multi_tenant() && schema=== "public";
      const isAdmin = (req.user || {}).role_id === 1;
      const adminItems = [
        { link: "/table", label: "Tables" },
        { link: "/viewedit", label: "Views" },
        { link: "/files", label: "Files" },
        {
          label: "Settings",
          subitems: [
            { link: "/plugins", label: "Plugins" },
            { link: "/useradmin", label: "Users" },
            { link: "/config", label: "Configuration" },
            { link: "/admin", label: "Admin" },
            ...(tenant_list ? [{ link: "/tenant/list", label: "Tenants" }] : []),
            ...(schema=== "public"? [{ link: "/crashlog", label: "Crash log" }] : [])
          ]
        }
      ];
      const currentUrl = req.originalUrl.split("?")[0];
      const stdHeaders = [{ css: "/saltcorn.css" }, { script: "/saltcorn.js" }];
      const brand = {
        name: getState().getConfig("site_name")
      };
      const menu = [
        views.length > 0 && {
          section: "Views",
          items: views
        },
        extra_menu.length > 0 && {
          section: "Links",
          items: extra_menu
        },
        isAdmin && {
          section: "Admin",
          items: adminItems
        },
        {
          section: "User",
          items: authItems
        }
      ].filter(s => s);
      res.send(
        getState().layout.wrap({
          title,
          brand,
          menu,
          currentUrl,
          alerts: getFlashes(req),
          body: html.length === 1 ? html[0] : html.join(""),
          headers: [...stdHeaders, ...getState().headers]
        })
      );
    };
    next();
  });
  mountRoutes(app);

  app.get("/", setTenant, homepage);
  app.use(errors);
  return app;
};
module.exports = getApp;
