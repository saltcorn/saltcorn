const express = require("express");
const mountRoutes = require("./routes");
const { wrap, link, renderForm } = require("saltcorn-markup");
const { ul, li, div, small } = require("saltcorn-markup/tags");
const View = require("saltcorn-data/models/view");

const State = require("saltcorn-data/db/state");
const db = require("saltcorn-data/db");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const User = require("saltcorn-data/models/user");
const flash = require("connect-flash");

const app = express();

const basePlugin = require("saltcorn-base-plugin");

basePlugin.register();

app.use(express.urlencoded({ extended: true }));
app.use(require("cookie-parser")());

app.use(
  session({
    store: new pgSession({
      pool: db.pool
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

passport.use(
  "local",
  new LocalStrategy(
    { passReqToCallback: true, usernameField: "email" },
    (req, email, password, done) => {
      loginAttempt();
      async function loginAttempt() {
        const mu = await User.authenticate({ email, password });
        if (mu) return done(null, { email: mu.email, role_id: mu.role_id });
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
      { link: "/useradmin", label: "Users" }
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
      wrap({
        title,
        menu,
        alerts: getFlashes(req),
        body: html.join("")
      })
    );
  };
  next();
});
mountRoutes(app);

app.get("/", async (req, res) => {
  const isAuth = req.isAuthenticated();
  const views = State.views.filter(
    v => v.on_root_page && (isAuth || v.is_public)
  );

  if (views.length === 0)
    res.sendWrap("Hello", "Welcome! you have no defined views");
  else if (views.length === 1) {
    const view = await View.findOne({ name: views[0].name });
    if (!req.isAuthenticated() && !view.is_public) {
      res.sendWrap("Hello", "Welcome! you have no defined views");
    } else {
      const resp = await view.run(req.query);
      const state_form = await view.get_state_form(req.query);

      res.sendWrap(
        `${view.name} view`,
        div(state_form ? renderForm(state_form) : "", resp)
      );
    }
  } else {
    const viewlis = views.map(v => li(link(`/view/${v.name}`, v.name)));
    res.sendWrap("Hello", ul(viewlis));
  }
});

module.exports = app;
