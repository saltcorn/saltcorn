const express = require("express");
const mountRoutes = require("./routes");
const { wrap, ul, link, ul_nav, alert } = require("./routes/markup.js");
const { get_available_views } = require("./db/state");
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
    { passReqToCallback: true },
    (req, username, password, done) => {
      loginAttempt();
      async function loginAttempt() {
        const mu = await User.authenticate({ email: username, password });
        if (mu) return done(null, [{ username: mu.email }]);
        else {
          req.flash("danger", "Incorrect user or password");

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
    console.log("athenticated", req.isAuthenticated());
    const views = get_available_views();
    const mkAlert = ty => alert(ty, req.flash(ty));
    const authItem = req.isAuthenticated()
      ? ["/auth/logout", "Logout"]
      : ["/auth/login", "Login"];
    const menuItems = [
      ...views.map(v => [`/view/${v.name}`, v.name]),
      ["/table", "Edit Tables"],
      ["/viewedit/list", "Edit Views"],
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

app.get("/", (req, res) => res.sendWrap("Hello", "Hello World!"));

module.exports = app;
