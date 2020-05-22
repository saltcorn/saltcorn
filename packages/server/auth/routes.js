const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { setTenant } = require("../routes/utils.js");

const {
  mkTable,
  renderForm,
  wrap,
  h,
  link,
  post_btn
} = require("@saltcorn/markup");
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

router.get("/login", setTenant, async (req, res) => {
  res.sendWrap(
    `Login`,
    renderForm(loginForm()),
    "Don't have an account? ",
    link("/auth/signup", "Signup »")
  );
});

router.get("/logout", setTenant, (req, res) => {
  req.logout();
  req.session.destroy(err => {
    if (err) return next(err);
    req.logout();
    res.redirect("/auth/login");
  });
});

router.get("/signup", setTenant, async (req, res) => {
  const form = loginForm();
  form.action = "/auth/signup";
  form.submitLabel = "Sign up";
  res.sendWrap(
    `Sign up`,
    renderForm(form),
    "Already have an account? ",
    link("/auth/login", "Login »")
  );
});

router.post("/signup", setTenant, async (req, res) => {
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
  setTenant,
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
