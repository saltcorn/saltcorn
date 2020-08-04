const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { setTenant, error_catcher } = require("../routes/utils.js");
const { getState } = require("@saltcorn/data/db/state");

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
      new Field({
        label: "E-mail",
        name: "email",
        input_type: "text",
        validator: s => s.length < 128
      }),
      new Field({ label: "Password", name: "password", input_type: "password" })
    ],
    action: "/auth/login",
    submitLabel: "Login"
  });

router.get(
  "/login",
  setTenant,
  error_catcher(async (req, res) => {
    const allow_signup = getState().getConfig("allow_signup");
    res.sendWrap(
      `Login`,
      renderForm(loginForm(), req.csrfToken()),
      ...(allow_signup
        ? ["Don't have an account? ", link("/auth/signup", "Signup »")]
        : [])
    );
  })
);

router.get("/logout", setTenant, (req, res) => {
  req.logout();
  req.session.destroy(err => {
    if (err) return next(err);
    req.logout();
    res.redirect("/auth/login");
  });
});

router.get(
  "/signup",
  setTenant,
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_signup")) {
      const form = loginForm();
      form.action = "/auth/signup";
      form.submitLabel = "Sign up";
      res.sendWrap(
        `Sign up`,
        renderForm(form, req.csrfToken()),
        "Already have an account? ",
        link("/auth/login", "Login »")
      );
    } else {
      req.flash("danger", "Signups not enabled");
      res.redirect("/auth/login");
    }
  })
);

router.get(
  "/create_first_user",
  setTenant,
  error_catcher(async (req, res) => {
    const hasUsers = await User.nonEmpty();
    if (!hasUsers) {
      const form = loginForm();
      form.action = "/auth/create_first_user";
      form.submitLabel = "Create user";
      form.blurb =
        "Please create your first user account, which will have administrative privileges. You can add other users and give them administrative privileges later.";
      res.sendWrap(`Create first user`, renderForm(form, req.csrfToken()));
    } else {
      req.flash("danger", "Users already present");
      res.redirect("/auth/login");
    }
  })
);
router.post(
  "/create_first_user",
  setTenant,
  error_catcher(async (req, res) => {
    const hasUsers = await User.nonEmpty();
    if (!hasUsers) {
      const { email, password } = req.body;
      console.log("creating user")
      const u = await User.create({ email, password, role_id: 1 });
      console.log({u})

      req.login(
        {
          email: u.email,
          id: u.id,
          role_id: u.role_id,
          tenant: db.getTenantSchema()
        },
        function(err) {
      console.log({err})

          if (!err) {
            res.redirect("/");
          } else {
            req.flash("danger", err);
            res.redirect("/auth/signup");
          }
        }
      );
    } else {
      req.flash("danger", "Users already present");
      res.redirect("/auth/login");
    }
  })
);
router.post(
  "/signup",
  setTenant,
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_signup")) {
      const { email, password } = req.body;
      if (email.length > 127) {
        req.flash("danger", "E-mail too long");
        res.redirect("/auth/signup");
        return;
      }

      const us = await User.find({ email });
      if (us.length > 0) {
        req.flash("danger", "Account already exists");
        res.redirect("/auth/signup");
        return;
      }

      const u = await User.create({ email, password });

      req.login(
        {
          email: u.email,
          id: u.id,
          role_id: u.role_id,
          tenant: db.getTenantSchema()
        },
        function(err) {
          if (!err) {
            res.redirect("/");
          } else {
            req.flash("danger", err);
            res.redirect("/auth/signup");
          }
        }
      );
    } else {
      req.flash("danger", "Signups not enabled");
      res.redirect("/auth/login");
    }
  })
);

router.post(
  "/login",
  setTenant,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/auth/login",
    failureFlash: true
  }),
  error_catcher(async (req, res) => {
    if (req.body.remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // Cookie expires after 30 days
    } else {
      req.session.cookie.expires = false; // Cookie expires at end of session
    }
    req.flash("success", "Login sucessful");
    res.redirect("/");
  })
);
