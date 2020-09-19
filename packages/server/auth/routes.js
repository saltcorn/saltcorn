const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { setTenant, error_catcher, loggedIn } = require("../routes/utils.js");
const { getState } = require("@saltcorn/data/db/state");
const { send_reset_email } = require("./resetpw");
const {
  mkTable,
  renderForm,
  wrap,
  h,
  link,
  post_btn,
} = require("@saltcorn/markup");
const passport = require("passport");
const { div, table, tbody, th, td, tr } = require("@saltcorn/markup/tags");
const { resetPasswordWithToken } = require("@saltcorn/data/models/user");

const router = new Router();
module.exports = router;

const loginForm = () =>
  new Form({
    fields: [
      new Field({
        label: "E-mail",
        name: "email",
        input_type: "text",
        validator: (s) => s.length < 128,
      }),
      new Field({
        label: "Password",
        name: "password",
        input_type: "password",
      }),
    ],
    action: "/auth/login",
    submitLabel: "Login",
  });

const forgotForm = () =>
  new Form({
    blurb:
      "Enter your email address below and we'll send you a link to reset your password.",
    fields: [
      new Field({
        label: "E-mail",
        name: "email",
        input_type: "text",
        validator: (s) => s.length < 128,
      }),
    ],
    action: "/auth/forgot",
    submitLabel: "Reset password",
  });

const resetForm = (body) => {
  const form = new Form({
    blurb: "Enter your new password below",
    fields: [
      new Field({
        label: "Password",
        name: "password",
        input_type: "password",
      }),
      new Field({
        name: "token",
        input_type: "hidden",
      }),
      new Field({
        name: "email",
        input_type: "hidden",
      }),
    ],
    action: "/auth/reset",
    submitLabel: "Set password",
  });
  form.values.email = body && body.email;
  form.values.token = body && body.token;
  return form;
};
const getAuthLinks = (current) => {
  const links = {};
  const state = getState();
  if (current !== "login") links.login = "/auth/login";
  if (current !== "signup" && state.getConfig("allow_signup"))
    links.signup = "/auth/signup";
  if (current !== "forgot" && state.getConfig("allow_forgot"))
    links.forgot = "/auth/forgot";

  return links;
};

router.get(
  "/login",
  setTenant,
  error_catcher(async (req, res) => {
    res.sendAuthWrap(`Login`, loginForm(), getAuthLinks("login"));
  })
);

router.get("/logout", setTenant, (req, res) => {
  req.logout();
  req.session.destroy((err) => {
    if (err) return next(err);
    req.logout();
    res.redirect("/auth/login");
  });
});

router.get(
  "/forgot",
  setTenant,
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_forgot", false)) {
      res.sendAuthWrap(`Reset password`, forgotForm(), getAuthLinks("forgot"));
    } else {
      req.flash(
        "danger",
        "Password reset not enabled. Contact your administrator."
      );
      res.redirect("/auth/login");
    }
  })
);

router.get(
  "/reset",
  setTenant,
  error_catcher(async (req, res) => {
    const form = resetForm(req.query);
    res.sendAuthWrap(`Reset password`, form, {});
  })
);

router.post(
  "/reset",
  setTenant,
  error_catcher(async (req, res) => {
    const result = await User.resetPasswordWithToken({
      email: req.body.email,
      reset_password_token: req.body.token,
      password: req.body.password,
    });
    if (result.success) {
      req.flash("success", "Password reset. Log in with your new password");
    } else {
      req.flash("danger", result.error);
    }
    res.redirect("/auth/login");
  })
);
router.post(
  "/forgot",
  setTenant,
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_forgot")) {
      const { email } = req.body;
      const u = await User.findOne({ email });
      const respond = () => {
        req.flash("success", "Email with password reset link sent");
        res.redirect("/auth/login");
      };
      if (!u) {
        respond();
        return;
      }
      //send email
      await send_reset_email(u, req);

      respond();
    } else {
      req.flash(
        "danger",
        "Password reset not enabled. Contact your administrator."
      );
      res.redirect("/auth/login");
    }
  })
);
router.get(
  "/signup",
  setTenant,
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_signup")) {
      const form = loginForm();
      form.action = "/auth/signup";
      form.submitLabel = "Sign up";
      res.sendAuthWrap(`Sign up`, form, getAuthLinks("signup"));
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
      res.sendAuthWrap(`Create first user`, form, {});
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
      const u = await User.create({ email, password, role_id: 1 });
      req.login(
        {
          email: u.email,
          id: u.id,
          role_id: u.role_id,
          tenant: db.getTenantSchema(),
        },
        function (err) {
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
          tenant: db.getTenantSchema(),
        },
        function (err) {
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
    failureFlash: true,
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

const changPwForm = () =>
  new Form({
    action: "/auth/settings",
    submitLabel: "Change",
    fields: [
      {
        label: "Old password",
        name: "password",
        input_type: "password",
      },
      {
        label: "New password",
        name: "new_password",
        input_type: "password",
        validator: (pw) => (pw.length < 6 ? "Too short" : true),
      },
    ],
  });
const userSettings = (req, form) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [{ text: "User" }, { text: "Settings" }],
    },
    {
      type: "card",
      title: "User",
      contents: table(tbody(tr(th("Email: "), td(req.user.email)))),
    },
    {
      type: "card",
      title: "Change password",
      contents: renderForm(form, req.csrfToken()),
    },
  ],
});
router.get(
  "/settings",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    res.sendWrap("User settings", userSettings(req, changPwForm()));
  })
);

router.post(
  "/settings",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const form = changPwForm();
    const user = await User.findOne({ id: req.user.id });
    form.fields[0].validator = (oldpw) => {
      const cmp = user.checkPassword(oldpw);
      if (cmp) return true;
      else return "Password does not match";
    };

    form.validate(req.body);

    if (form.hasErrors) {
      res.sendWrap("User settings", userSettings(req, form));
    } else {
      await user.changePasswordTo(form.values.new_password);
      req.flash("success", "Password changed");
      res.redirect("/auth/settings");
    }
  })
);
