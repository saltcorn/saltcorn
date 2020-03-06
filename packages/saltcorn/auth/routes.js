const Router = require("express-promise-router");

const db = require("../db");
const User = require("./user");
const Field = require("../db/field");
const Form = require("../models/form");
const {
  mkTable,
  renderForm,
  wrap,
  h,
  link,
  post_btn
} = require("../routes/markup.js");
const passport = require("passport");

const router = new Router();
module.exports = router;

const loginForm = () =>
  new Form({
    fields: [
      new Field({ label: "E-mail", name: "email", input_type: "text" }),
      new Field({ label: "Password", name: "password", input_type: "password" })
    ],
    action: "/auth/login",
    submitLabel: "Login"
  });

router.get("/login", async (req, res) => {
  res.sendWrap(
    `Login`,
    h(3, "Login"),
    renderForm(loginForm()),
    "Don't have an account? ",
    link("/auth/signup", "Signup »")
  );
});

router.get("/logout", (req, res) => {
  req.logout();
  req.session.destroy(err => {
    if (err) return next(err);
    req.logout();
    res.redirect("/auth/login");
  });
});

router.get("/signup", async (req, res) => {
  const form = loginForm();
  form.action = "/auth/signup";
  form.submitLabel = "Sign up";
  res.sendWrap(
    `Sign up`,
    h(3, "Sign up"),
    renderForm(form),
    "Already have an account? ",
    link("/auth/login", "Login »")
  );
});

router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const u = await User.create({ email, password });

  req.login({ email: u.email, role_id: u.role_id }, function(err) {
    if (!err) {
      res.redirect("/");
    } else {
      req.flash("danger", err);
      res.redirect("/auth/signup");
    }
  });
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/auth/login",
    failureFlash: true
  }),
  async (req, res) => {
    if (req.body.remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // Cookie expires after 30 days
    } else {
      req.session.cookie.expires = false; // Cookie expires at end of session
    }
    req.flash("success", "Login sucessful");
    res.redirect("/");
  }
);
