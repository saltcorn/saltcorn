const express = require("express");
const mountRoutes = require("./routes");
const { ul, li, div, small } = require("saltcorn-markup/tags");

const State = require("saltcorn-data/db/state");
const db = require("saltcorn-data/db");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const User = require("saltcorn-data/models/user");
const flash = require("connect-flash");
const load_plugins = require("./load_plugins");
const { migrate } = require("saltcorn-data/migrate");
const homepage = require("./routes/homepage");

const getApp = async () => {
  const app = express();
  await migrate();
  await load_plugins.loadAllPlugins();

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(require("cookie-parser")());

  app.use(
    session({
      store: new pgSession({
        pool: db.pool,
        tableName: "_sc_session"
      }),
      secret: "tja3j675m5wsjj65",
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
      //etag:false,
      //maxage: 1000
    })
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
              role_id: mu.role_id
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

  app.use(function(req, res, next) {
    res.sendWrap = function(title, ...html) {
      const isAuth = req.isAuthenticated();
      const views = State.views
        .filter(v => v.on_menu && (isAuth || v.is_public))
        .map(v => ({ link: `/view/${v.name}`, label: v.name }));
      const authItems = isAuth
        ? [
            { label: small(req.user.email.split("@")[0]) },
            { link: "/auth/logout", label: "Logout" }
          ]
        : [{ link: "/auth/login", label: "Login" }];
      const isAdmin = (req.user || {}).role_id === 1;
      const adminItems = [
        { link: "/table", label: "Tables" },
        { link: "/viewedit/list", label: "Views" },
        { link: "/plugins", label: "Plugins" },
        {
          label: "Settings",
          subitems: [
            { link: "/useradmin", label: "Users" },
            { link: "/config", label: "Configuration" }
          ]
        }
      ];

      const menu = [
        {
          section: "Views",
          items: views
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
        State.layout.wrap({
          title,
          menu,
          alerts: getFlashes(req),
          body: html.length === 1 ? html[0] : html.join(""),
          headers: State.headers
        })
      );
    };
    next();
  });
  mountRoutes(app);

  app.get("/", homepage);
  return app;
};
module.exports = getApp;
