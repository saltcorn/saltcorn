const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const {
  setTenant,
  error_catcher,
  loggedIn,
  csrfField,
} = require("../routes/utils.js");
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
const {
  div,
  table,
  tbody,
  th,
  td,
  tr,
  form,
  select,
  option,
} = require("@saltcorn/markup/tags");
const { available_languages } = require("@saltcorn/data/models/config");
const rateLimit = require("express-rate-limit");
const moment = require("moment");
const router = new Router();
module.exports = router;

const loginForm = (req, isCreating) =>
  new Form({
    fields: [
      new Field({
        label: req.__("E-mail"),
        name: "email",
        input_type: "text",
        validator: (s) => s.length < 128,
      }),
      new Field({
        label: req.__("Password"),
        name: "password",
        input_type: "password",
        validator: isCreating
          ? (pw) => User.unacceptable_password_reason(pw)
          : undefined,
      }),
    ],
    action: "/auth/login",
    submitLabel: req.__("Login"),
  });

const forgotForm = (req) =>
  new Form({
    blurb: req.__(
      "Enter your email address below and we'll send you a link to reset your password."
    ),
    fields: [
      new Field({
        label: req.__("E-mail"),
        name: "email",
        input_type: "text",
        validator: (s) => s.length < 128,
      }),
    ],
    action: "/auth/forgot",
    submitLabel: req.__("Reset password"),
  });

const resetForm = (body, req) => {
  const form = new Form({
    blurb: req.__("Enter your new password below"),
    fields: [
      new Field({
        label: req.__("Password"),
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
    submitLabel: req.__("Set password"),
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
    res.sendAuthWrap(req.__(`Login`), loginForm(req), getAuthLinks("login"));
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
      res.sendAuthWrap(
        req.__(`Reset password`),
        forgotForm(req),
        getAuthLinks("forgot")
      );
    } else {
      req.flash(
        "danger",
        req.__("Password reset not enabled. Contact your administrator.")
      );
      res.redirect("/auth/login");
    }
  })
);

router.get(
  "/reset",
  setTenant,
  error_catcher(async (req, res) => {
    const form = resetForm(req.query, req);
    res.sendAuthWrap(req.__(`Reset password`), form, {});
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
      req.flash(
        "success",
        req.__("Password reset. Log in with your new password")
      );
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
        req.flash("success", req.__("Email with password reset link sent"));
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
        req.__("Password reset not enabled. Contact your administrator.")
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
      const form = loginForm(req, true);
      form.action = "/auth/signup";
      form.submitLabel = req.__("Sign up");
      res.sendAuthWrap(req.__(`Sign up`), form, getAuthLinks("signup"));
    } else {
      req.flash("danger", req.__("Signups not enabled"));
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
      const form = loginForm(req, true);
      form.action = "/auth/create_first_user";
      form.submitLabel = req.__("Create user");
      form.blurb = req.__(
        "Please create your first user account, which will have administrative privileges. You can add other users and give them administrative privileges later."
      );
      res.sendAuthWrap(req.__(`Create first user`), form, {});
    } else {
      req.flash("danger", req.__("Users already present"));
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
      const form = loginForm(req, true);
      form.validate(req.body);

      if (form.hasErrors) {
        form.action = "/auth/create_first_user";
        form.submitLabel = req.__("Create user");
        form.blurb = req.__(
          "Please create your first user account, which will have administrative privileges. You can add other users and give them administrative privileges later."
        );
        res.sendAuthWrap(req.__(`Create first user`), form, {});
      } else {
        const { email, password } = form.values;
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
      }
    } else {
      req.flash("danger", req.__("Users already present"));
      res.redirect("/auth/login");
    }
  })
);
router.post(
  "/signup",
  setTenant,
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_signup")) {
      const form = loginForm(req, true);
      form.validate(req.body);

      if (form.hasErrors) {
        form.action = "/auth/signup";
        form.submitLabel = req.__("Sign up");
        res.sendAuthWrap(req.__(`Sign up`), form, getAuthLinks("signup"));
      } else {
        const { email, password } = form.values;
        if (email.length > 127) {
          req.flash("danger", req.__("E-mail too long"));
          res.redirect("/auth/signup");
          return;
        }

        const us = await User.find({ email });
        if (us.length > 0) {
          req.flash("danger", req.__("Account already exists"));
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
      }
    } else {
      req.flash("danger", req.__("Signups not enabled"));
      res.redirect("/auth/login");
    }
  })
);
function handler(req, res) {
  console.log(
    `Failed login attempt for: ${req.body.email} from ${req.ip} UA ${req.get(
      "User-Agent"
    )}`
  );
  req.flash(
    "error",
    "You've made too many failed attempts in a short period of time, please try again " +
      moment(req.rateLimit.resetTime).fromNow()
  );
  res.redirect("/auth/login"); // brute force protection triggered, send them back to the login page
}
const ipLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  handler,
});

const userLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 100 requests per windowMs
  keyGenerator: (req) => req.body.email,
  handler,
});

router.post(
  "/login",
  setTenant,
  ipLimiter,
  userLimiter,
  passport.authenticate("local", {
    //successRedirect: "/",
    failureRedirect: "/auth/login",
    failureFlash: true,
  }),
  error_catcher(async (req, res) => {
    ipLimiter.resetKey(req.ip);
    userLimiter.resetKey(req.body.email);
    if (req.body.remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // Cookie expires after 30 days
    } else {
      req.session.cookie.expires = false; // Cookie expires at end of session
    }
    req.flash("success", req.__("Welcome, %s!", req.body.email));
    res.redirect("/");
  })
);

const changPwForm = (req) =>
  new Form({
    action: "/auth/settings",
    submitLabel: req.__("Change"),
    fields: [
      {
        label: req.__("Old password"),
        name: "password",
        input_type: "password",
      },
      {
        label: req.__("New password"),
        name: "new_password",
        input_type: "password",
        validator: (pw) => User.unacceptable_password_reason(pw),
      },
    ],
  });
const setLanguageForm = (req, user) =>
  form(
    {
      action: `/auth/setlanguage/`,
      method: "post",
    },
    csrfField(req.csrfToken()),
    select(
      { name: "locale", onchange: "form.submit()" },
      Object.entries(available_languages).map(([locale, language]) =>
        option(
          {
            value: locale,
            ...(user && user.language === locale && { selected: true }),
          },
          language
        )
      )
    )
  );

const userSettings = (req, form, user) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [{ text: req.__("User") }, { text: req.__("Settings") }],
    },
    {
      type: "card",
      title: req.__("User"),
      contents: table(
        tbody(
          tr(th(req.__("Email: ")), td(req.user.email)),
          tr(th(req.__("Language: ")), td(setLanguageForm(req, user)))
        )
      ),
    },
    {
      type: "card",
      title: req.__("Change password"),
      contents: renderForm(form, req.csrfToken()),
    },
  ],
});

router.post(
  "/setlanguage",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const u = await User.findOne({ id: req.user.id });
    const newlang = available_languages[req.body.locale];
    if (newlang) {
      await u.set_language(req.body.locale);
      req.login(
        {
          email: u.email,
          id: u.id,
          role_id: u.role_id,
          language: req.body.locale,
          tenant: db.getTenantSchema(),
        },
        function (err) {
          if (!err) {
            req.flash("success", req.__("Language changed to %s", newlang));
            res.redirect("/auth/settings");
          } else {
            req.flash("danger", err);
            res.redirect("/auth/settings");
          }
        }
      );
    } else {
      req.flash("danger", req.__("Language not found"));
      res.redirect("/auth/settings");
    }
  })
);
router.get(
  "/settings",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    res.sendWrap(
      req.__("User settings"),
      userSettings(req, changPwForm(req), user)
    );
  })
);

router.post(
  "/settings",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const form = changPwForm(req);
    const user = await User.findOne({ id: req.user.id });
    form.fields[0].validator = (oldpw) => {
      const cmp = user.checkPassword(oldpw);
      if (cmp) return true;
      else return req.__("Password does not match");
    };

    form.validate(req.body);

    if (form.hasErrors) {
      res.sendWrap(req.__("User settings"), userSettings(req, form, user));
    } else {
      await user.changePasswordTo(form.values.new_password);
      req.flash("success", req.__("Password changed"));
      res.redirect("/auth/settings");
    }
  })
);
