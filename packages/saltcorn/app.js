const express = require("express");
const mountRoutes = require("./routes");
const { wrap, link, ul_nav, alert, renderForm } = require("./markup");
const { ul, li, div } = require("./markup/tags");
const View = require("./models/view");

const State = require("./db/state");
const db = require("./db");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const User = require("./auth/user");
const flash = require("connect-flash");

const app = express();
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

app.use(function(req, res, next) {
  res.sendWrap = function(title, ...html) {
    const isAuth = req.isAuthenticated();
    const views = State.available_views.filter(
      v => v.on_menu && (isAuth || v.is_public)
    );
    const mkAlert = ty => alert(ty, req.flash(ty));
    const authItem = isAuth
      ? ["/auth/logout", "Logout"]
      : ["/auth/login", "Login"];
    const adminItems =
      (req.user || {}).role_id === 1
        ? [
            ["/table", "Tables"],
            ["/viewedit/list", "Views"],
            ["/useradmin", "Users"]
          ]
        : [];

    const menuItems = [
      ...views.map(v => [`/view/${v.name}`, v.name]),
      ...adminItems,
      authItem
    ];
    res.send(
      wrap(
        title,
        ul_nav(menuItems),
        mkAlert("error"),
        mkAlert("success"),
        mkAlert("danger"),
        mkAlert("warning"),

        ...html
      )
    );
  };
  next();
});
mountRoutes(app);

app.get("/", async (req, res) => {
  const isAuth = req.isAuthenticated();
  const views = State.available_views.filter(
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
