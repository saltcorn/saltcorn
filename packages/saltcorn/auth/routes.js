const Router = require("express-promise-router");

const db = require("../db");
const User = require("./user");
const {
  mkTable,
  mkForm,
  wrap,
  h,
  link,
  post_btn
} = require("../routes/markup.js");
const passport = require("passport");

const router = new Router();
module.exports = router;

router.get("/login", async (req, res) => {
  res.sendWrap(
    `Login`,
    h(3, "Login"),
    mkForm("/auth/login", [
      { label: "E-mail", name: "username", input_type: "text" },
      { label: "Password", name: "password", input_type: "password" }
    ]),
    "Don't have an account? ",
    link("/auth/signup", "Signup »")
  );
});

router.get("/signup", async (req, res) => {
  res.sendWrap(
    `Sign up`,
    h(3, "Sign up"),
    mkForm("/auth/signup", [
      { label: "E-mail", name: "username", input_type: "text" },
      { label: "Password", name: "password", input_type: "password" }
    ]),
    "Already have an account? ",
    link("/auth/login", "Login »")
  );
});

router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const u = await User.create({ email, password });
  res.redirect(`/table/`);
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/table/",
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
