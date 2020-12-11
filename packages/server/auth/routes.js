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
  text,
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
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
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
const getAuthLinks = (current, noMethods) => {
  const links = { methods: [] };
  const state = getState();
  if (current !== "login") links.login = "/auth/login";
  if (current !== "signup" && state.getConfig("allow_signup"))
    links.signup = "/auth/signup";
  if (current !== "forgot" && state.getConfig("allow_forgot"))
    links.forgot = "/auth/forgot";
  if (!noMethods)
    Object.entries(getState().auth_methods).forEach(([name, auth]) => {
      links.methods.push({
        icon: auth.icon,
        label: auth.label,
        name,
        url: `/auth/login-with/${name}`,
      });
    });
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

const getNewUserForm = async (new_user_view_name, req, askEmail) => {
  const view = await View.findOne({ name: new_user_view_name });
  const table = await Table.findOne({ name: "users" });
  const fields = await table.getFields();
  const { columns, layout } = view.configuration;

  const tfields = (columns || [])
    .map((column) => {
      if (column.type === "Field") {
        const f = fields.find((fld) => fld.name === column.field_name);
        if (f) {
          f.fieldview = column.fieldview;
          return f;
        }
      }
    })
    .filter((tf) => !!tf);

  const form = new Form({
    action: `/auth/signup_final`,
    fields: tfields,
    layout,
    submitLabel: req.__("Sign up"),
  });
  await form.fill_fkey_options();
  if (askEmail) {
    form.fields.push(
      new Field({
        name: "email",
        label: req.__("Email"),
        type: "String",
        required: true,
      })
    );
    form.layout = {
      above: [
        {
          type: "blank",
          contents: "Email",
        },
        {
          type: "field",
          fieldview: "edit",
          field_name: "email",
        },
        form.layout,
      ],
    };
  } else {
    form.hidden("email");
  }
  form.hidden("password");
  return form;
};

const signup_login_with_user = (u, req, res) =>
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

router.get(
  "/signup_final_ext",
  setTenant,
  error_catcher(async (req, res) => {
    const new_user_form = getState().getConfig("new_user_form");
    if (!req.user || req.user.id || !new_user_form) {
      req.flash("danger", "This is the wrong place");
      res.redirect("/auth/login");
      return;
    }
    const form = await getNewUserForm(new_user_form, req, !req.user.email);
    form.action = "/auth/signup_final_ext";
    form.values.email = req.user.email;
    res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
  })
);

router.post(
  "/signup_final_ext",
  setTenant,
  error_catcher(async (req, res) => {
    const new_user_form = getState().getConfig("new_user_form");
    if (!req.user || req.user.id || !new_user_form) {
      req.flash("danger", "This is the wrong place");
      res.redirect("/auth/login");
      return;
    }
    const form = await getNewUserForm(new_user_form, req, !req.user.email);
    form.action = "/auth/signup_final_ext";

    form.validate(req.body);
    if (form.hasErrors) {
      res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
      return;
    }
    try {
      const uobj = { ...req.user, ...form.values };
      const u = await User.create(uobj);
      signup_login_with_user(u, req, res);
    } catch (e) {
      const table = await Table.findOne({ name: "users" });
      const fields = await table.getFields();
      form.hasErrors = true;
      const unique_field_error = fields.find(
        (f) =>
          e.message ===
          `duplicate key value violates unique constraint "users_${f.name}_unique"`
      );
      if (unique_field_error)
        form.errors[unique_field_error.name] = req.__("Already in use");
      else form.errors._form = e.message;
      res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
    }
  })
);
router.post(
  "/signup_final",
  setTenant,
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_signup")) {
      const new_user_form = getState().getConfig("new_user_form");
      const form = await getNewUserForm(new_user_form, req);
      form.validate(req.body);
      if (form.hasErrors) {
        res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
      } else {
        try {
          const u = await User.create(form.values);
          signup_login_with_user(u, req, res);
        } catch (e) {
          const table = await Table.findOne({ name: "users" });
          const fields = await table.getFields();
          form.hasErrors = true;
          const unique_field_error = fields.find(
            (f) =>
              e.message ===
              `duplicate key value violates unique constraint "users_${f.name}_unique"`
          );
          if (unique_field_error)
            form.errors[unique_field_error.name] = req.__("Already in use");
          else form.errors._form = e.message;
          res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
        }
      }
    } else {
      req.flash("danger", req.__("Signups not enabled"));
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
        const new_user_form = getState().getConfig("new_user_form");
        if (new_user_form) {
          const form = await getNewUserForm(new_user_form, req);
          form.values.email = email;
          form.values.password = password;
          res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
        } else {
          const u = await User.create({ email, password });
          signup_login_with_user(u, req, res);
        }
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
router.get(
  "/login-with/:method",
  setTenant,
  error_catcher(async (req, res, next) => {
    const { method } = req.params;
    const auth = getState().auth_methods[method];
    if (auth) {
      passport.authenticate(method, auth.parameters)(req, res, next);
    } else {
      req.flash(
        "danger",
        req.__("Unknown authentication method %s", text(method))
      );
      res.redirect("/");
    }
  })
);

router.get(
  "/callback/:method",
  setTenant,
  error_catcher(async (req, res, next) => {
    const { method } = req.params;
    const auth = getState().auth_methods[method];
    if (auth) {
      passport.authenticate(method, { failureRedirect: "/auth/login" })(
        req,
        res,
        () => {
          if (!req.user) return;
          if (!req.user.id) {
            res.redirect("/auth/signup_final_ext");
          }
          if (!req.user.email) {
            res.redirect("/auth/set-email");
          } else {
            req.flash("success", req.__("Welcome, %s!", req.user.email));
            res.redirect("/");
          }
          //next();
        }
      );
    }
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

const setEmailForm = (req) =>
  new Form({
    action: "/auth/set-email",
    blurb: req.__("Please enter your email address"),
    fields: [
      { name: "email", label: req.__("Email"), type: "String", required: true },
    ],
  });

router.get(
  "/set-email",
  setTenant,
  error_catcher(async (req, res) => {
    res.sendWrap(
      req.__("Set Email"),
      renderForm(setEmailForm(req), req.csrfToken())
    );
  })
);

router.post(
  "/set-email",
  setTenant,
  error_catcher(async (req, res) => {
    const form = setEmailForm(req);
    form.validate(req.body);
    if (form.hasErrors || !req.user || !req.user.id) {
      res.sendWrap(req.__("Set Email"), renderForm(form, req.csrfToken()));
      return;
    }
    const existing = await User.findOne({ email: form.values.email });
    if (existing) {
      form.hasErrors = true;
      form.errors.email = req.__(
        "A user with this email address already exists"
      );
      res.sendWrap(req.__("Set Email"), renderForm(form, req.csrfToken()));
      return;
    }

    const u = await User.findOne({ id: req.user.id });
    await u.update({ email: form.values.email });
    u.email = form.values.email;
    req.login(
      {
        email: u.email,
        id: u.id,
        role_id: u.role_id,
        tenant: db.getTenantSchema(),
      },
      function (err) {
        if (!err) {
          req.flash("success", req.__("Welcome, %s!", u.email));
          res.redirect("/");
        } else {
          req.flash("danger", err);
          res.redirect("/");
        }
      }
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
