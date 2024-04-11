/**
 * @category server
 * @module auth/routes
 * @subcategory auth
 */
const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Field = require("@saltcorn/data/models/field");
const Page = require("@saltcorn/data/models/page");
const Form = require("@saltcorn/data/models/form");
const File = require("@saltcorn/data/models/file");

const { send_verification_email } = require("@saltcorn/data/models/email");
const {
  error_catcher,
  loggedIn,
  csrfField,
  setTenant,
  is_relative_url,
} = require("../routes/utils.js");
const { getState } = require("@saltcorn/data/db/state");
const { send_reset_email } = require("./resetpw");
const { renderForm, post_btn } = require("@saltcorn/markup");
const passport = require("passport");
const {
  a,
  img,
  text,
  table,
  tbody,
  th,
  td,
  tr,
  h4,
  form,
  select,
  option,
  span,
  i,
  div,
  code,
  pre,
  p,
  script,
  domReady,
  button,
} = require("@saltcorn/markup/tags");
const {
  available_languages,
  check_email_mask,
} = require("@saltcorn/data/models/config");
const rateLimit = require("express-rate-limit");
const moment = require("moment");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const {
  getForm,
} = require("@saltcorn/data/base-plugin/viewtemplates/viewable_fields");
const { InvalidConfiguration, getSessionId } = require("@saltcorn/data/utils");
const Trigger = require("@saltcorn/data/models/trigger");
const { restore_backup } = require("../markup/admin.js");
const { restore } = require("@saltcorn/admin-models/models/backup");
const load_plugins = require("../load_plugins");
const fs = require("fs");
const base32 = require("thirty-two");
const qrcode = require("qrcode");
const totp = require("notp").totp;
const jwt = require("jsonwebtoken");

/**
 * @type {object}
 * @const
 * @namespace routesRouter
 * @category server
 * @subcategory auth
 */

const router = new Router();
module.exports = router;

/**
 * Login Form
 * @param {object} req
 * @param {boolean} isCreating
 * @returns {Form}
 */
const loginForm = (req, isCreating) => {
  const postAuthMethods = Object.entries(getState().auth_methods)
    // TBD unresolved parameter K
    // TBD unresolved postUsernamePassword
    .filter(([k, v]) => v.postUsernamePassword)
    .map(([k, v]) => v);
  const user_sublabel = postAuthMethods
    // TBD unresolved usernameLabel
    .map((auth) => `${auth.usernameLabel} for ${auth.label}`)
    .join(", ");
  const form = new Form({
    class: "login",
    fields: [
      new Field({
        label: req.__("E-mail"),
        name: "email",
        type: "String",
        attributes: {
          input_type: "email",
        },
        sublabel: user_sublabel || undefined,
        // fixed correct size of email is 254 https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address
        validator: (s) => s.length < 255,
      }),
      new Field({
        label: req.__("Password"),
        name: "password",
        input_type: "password",
        attributes: {
          autocomplete: "current-password",
        },
        validator: isCreating
          ? (pw) => User.unacceptable_password_reason(pw)
          : undefined,
      }),
    ],
    action: "/auth/login",
    submitLabel: req.__("Login"),
  });
  const { dest } = req.query;
  if (dest) {
    form.hidden("dest");
    form.values.dest = encodeURIComponent(dest);
  }
  return form;
};

/**
 * Forgot Form
 * @param {object} req
 * @returns {Form}
 */
const forgotForm = (req) =>
  new Form({
    blurb: req.__(
      "Enter your email address below and we'll send you a link to reset your password."
    ),
    fields: [
      new Field({
        label: req.__("E-mail"),
        name: "email",
        type: "String",
        attributes: {
          input_type: "email",
        },
        // fixed correct size of email is 254 https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address
        validator: (s) => s.length < 255,
      }),
    ],
    action: "/auth/forgot",
    submitLabel: req.__("Reset password"),
  });

/**
 * Reset Form
 * @param {object} body
 * @param {object} req
 * @returns {Form}
 */
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

/**
 * get Auth Links
 * @param {string} current
 * @param {boolean} noMethods
 * @returns {object}
 */
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
      const url = auth.postUsernamePassword
        ? `javascript:$('form.login').attr('action','/auth/login-with/${name}').submit();`
        : `/auth/login-with/${name}`;
      links.methods.push({
        icon: auth.icon,
        label: auth.label,
        name,
        url,
      });
    });
  return links;
};
/**
 * Login with jwt
 * @param {*} email
 * @param {*} password
 * @param {*} saltcornApp
 * @param {*} res
 */
const loginWithJwt = async (email, password, saltcornApp, res, req) => {
  const loginFn = async () => {
    const publicUserLink = getState().getConfig("public_user_link");
    const jwt_secret = db.connectObj.jwt_secret;
    if (email !== undefined && password !== undefined) {
      // with credentials
      const user = await User.findOne({ email });
      if (user && user.checkPassword(password)) {
        const now = new Date();
        const token = jwt.sign(
          {
            sub: email,
            user: user.session_object,
            iss: "saltcorn@saltcorn",
            aud: "saltcorn-mobile-app",
            iat: now.valueOf(),
            tenant: db.getTenantSchema(),
          },
          jwt_secret
        );
        if (!user.last_mobile_login) await user.updateLastMobileLogin(now);
        res.json(token);
      } else {
        res.json({
          alerts: [
            { type: "danger", msg: req.__("Incorrect user or password") },
          ],
        });
      }
    } else if (publicUserLink) {
      // public login
      const token = jwt.sign(
        {
          sub: "public",
          user: {
            role_id: 100,
            language: "en",
          },
          iss: "saltcorn@saltcorn",
          aud: "saltcorn-mobile-app",
          iat: new Date().valueOf(),
          tenant: db.getTenantSchema(),
        },
        jwt_secret
      );
      res.json(token);
    } else {
      res.json({
        alerts: [
          { type: "danger", msg: req.__("The public login is deactivated") },
        ],
      });
    }
  };
  if (saltcornApp && saltcornApp !== db.connectObj.default_schema) {
    await db.runWithTenant(saltcornApp, loginFn);
  } else {
    await loginFn();
  }
};

/**
 * GET /auth/login
 * @name get/login
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/login",
  error_catcher(async (req, res) => {
    const login_form_name = getState().getConfig("login_form", "");
    if (login_form_name) {
      const login_form = await View.findOne({ name: login_form_name });
      if (!login_form)
        res.sendAuthWrap(
          req.__(`Login`),
          loginForm(req),
          getAuthLinks("login")
        );
      else {
        const resp = await login_form.run_possibly_on_page({}, req, res);
        if (login_form.default_render_page) {
          const page = Page.findOne({ name: login_form.default_render_page });
          res.sendWrap(
            { title: req.__(`Login`), no_menu: page?.attributes?.no_menu },
            resp
          );
        } else res.sendAuthWrap(req.__(`Login`), resp, { methods: [] });
      }
    } else
      res.sendAuthWrap(req.__(`Login`), loginForm(req), getAuthLinks("login"));
  })
);

/**
 * GET /auth/logout
 * @name get/logout
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get("/logout", async (req, res, next) => {
  if (req.smr && req.user?.id) {
    const user = await User.findOne({ id: req.user.id });
    await user.updateLastMobileLogin(null);
    res.json({ success: true });
  } else if (req.logout) {
    req.logout(function (err) {
      const destination = getState().getConfig("logout_url", "/auth/login");
      if (req.session.destroy)
        req.session.destroy((err) => {
          if (err) return next(err);
          req.logout(() => {
            res.redirect(destination);
          });
        });
      else {
        req.logout(function (err) {
          req.session = null;
          res.redirect(destination);
        });
      }
    });
  }
});

/**
 * @name get/forgot
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/forgot",
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

/**
 * @name get/reset
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/reset",
  error_catcher(async (req, res) => {
    const form = resetForm(req.query, req);
    res.sendAuthWrap(req.__(`Reset password`), form, {});
  })
);

/**
 * @name get/verify
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/verify",
  error_catcher(async (req, res) => {
    const { token, email } = req.query;
    const result = await User.verifyWithToken({
      email,
      verification_token: token,
    });
    if (result.error) req.flash("danger", result.error);
    else if (result) {
      req.flash("success", req.__("Email verified"));
      const u = await User.findForSession({ email });
      if (u) await u.relogin(req);
    }
    res.redirect("/");
  })
);

/**
 * @name post/reset
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/reset",
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

/**
 * @name post/forgot
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/forgot",
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_forgot")) {
      const { email } = req.body;
      const u = await User.findOne({ email });
      const respond = () => {
        req.flash("success", req.__("Email with password reset link sent"));
        res.redirect("/auth/login");
      };
      if (!u || !u.password) {
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

const default_signup_form = async (req) => {
  const form = loginForm(req, true);
  const new_user_form = getState().getConfig("new_user_form", "");
  if (!new_user_form) {
    const userTable = Table.findOne({ name: "users" });
    const userFields = await userTable.getFields();

    for (const f of userFields) {
      if (f.required && !f.calculated && !["id", "email"].includes(f.name))
        form.fields.push(f);
    }
  }
  form.action = "/auth/signup";
  form.submitLabel = req.__("Sign up");
  return form;
};

/**
 * @name get/signup
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/signup",
  error_catcher(async (req, res) => {
    if (!getState().getConfig("allow_signup")) {
      req.flash("danger", req.__("Signups not enabled"));
      res.redirect("/auth/login");
      return;
    }
    const defaultSignup = async () => {
      const form = await default_signup_form(req);
      res.sendAuthWrap(req.__(`Sign up`), form, getAuthLinks("signup"));
    };
    const signup_form_name = getState().getConfig("signup_form", "");
    if (signup_form_name) {
      const signup_form = await View.findOne({ name: signup_form_name });
      if (!signup_form) await defaultSignup();
      else {
        const resp = await signup_form.run_possibly_on_page({}, req, res);
        if (signup_form.default_render_page) {
          const page = Page.findOne({ name: signup_form.default_render_page });
          res.sendWrap(
            { title: req.__(`Sign up`), no_menu: page?.attributes?.no_menu },
            resp
          );
        } else res.sendAuthWrap(req.__(`Sign up`), resp, { methods: [] });
      }
    } else await defaultSignup();
  })
);

/**
 * @name get/create_first_user
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/create_first_user",
  error_catcher(async (req, res) => {
    const hasUsers = await User.nonEmpty();
    if (!hasUsers) {
      const form = loginForm(req, true);
      form.action = "/auth/create_first_user";
      form.submitLabel = req.__("Create user");
      form.class = "create-first-user";
      form.blurb = req.__(
        "Please create your first user account, which will have administrative privileges. You can add other users and give them administrative privileges later."
      );
      const restore = restore_backup(
        req.csrfToken(),
        [i({ class: "fas fa-upload me-2 mt-2" }), req.__("Restore a backup")],
        `/auth/create_from_restore`
      );
      res.sendAuthWrap(
        req.__(`Create first user`),
        form,
        {},
        restore +
          script(
            domReady(
              `$('form.create-first-user button[type=submit]').click(function(){press_store_button(this)})`
            )
          )
      );
    } else {
      req.flash("danger", req.__("Users already present"));
      res.redirect("/auth/login");
    }
  })
);

/**
 * @name post/create_from_restore
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/create_from_restore",
  setTenant, // TODO why is this needed?????
  error_catcher(async (req, res) => {
    const hasUsers = await User.nonEmpty();
    if (!hasUsers) {
      const newPath = File.get_new_path();
      await req.files.file.mv(newPath);
      const err = await restore(
        newPath,
        (p) => load_plugins.loadAndSaveNewPlugin(p),
        true
      );
      if (err) req.flash("error", err);
      else req.flash("success", req.__("Successfully restored backup"));
      fs.unlink(newPath, function () {});
      res.redirect(`/auth/login`);
    } else {
      req.flash("danger", req.__("Users already present"));
      res.redirect("/auth/login");
    }
  })
);

/**
 * @name post/create_first_user
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/create_first_user",
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
        req.login(u.session_object, function (err) {
          if (!err) {
            Trigger.emitEvent("Login", null, u);
            res.redirect("/");
          } else {
            req.flash("danger", err);
            res.redirect("/auth/signup");
          }
        });
      }
    } else {
      req.flash("danger", req.__("Users already present"));
      res.redirect("/auth/login");
    }
  })
);

/**
 * @param {string} new_user_view_name
 * @param {object} req
 * @param {boolean} askEmail
 * @returns {Promise<Form>}
 * @throws {InvalidConfiguration}
 */
const getNewUserForm = async (new_user_view_name, req, askEmail) => {
  if (!new_user_view_name) return;
  const view = await View.findOne({ name: new_user_view_name });
  if (!view)
    throw new InvalidConfiguration("New user form view does not exist");
  if (view.viewtemplate !== "Edit") return;
  const table = Table.findOne({ name: "users" });
  const fields = table.getFields();
  const { columns, layout } = view.configuration;

  const tfields = (columns || [])
    .map((column) => {
      if (column.type === "Field") {
        const f = fields.find((fld) => fld.name === column.field_name);
        if (f) {
          f.fieldview = column.fieldview;
          if (f.type === "Key") {
            if (getState().keyFieldviews[column.fieldview])
              f.fieldviewObj = getState().keyFieldviews[column.fieldview];
            f.input_type =
              !f.fieldview || !f.fieldviewObj || f.fieldview === "select"
                ? "select"
                : "fromtype";
          }
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
        attributes: {
          input_type: "email",
        },
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
        {
          type: "line_break",
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

/**
 * @param {object} u
 * @param {object} req
 * @param {object} res
 * @returns {void}
 */
const signup_login_with_user = (u, req, res, redirUrl) => {
  const old_session_id = getSessionId(req);
  return req.login(u.session_object, function (err) {
    if (!err) {
      const session_id = getSessionId(req);
      Trigger.emitEvent("Login", null, u, { old_session_id, session_id });
      if (getState().verifier) res.redirect("/auth/verification-flow");
      else if (getState().get2FApolicy(u) === "Mandatory")
        res.redirect("/auth/twofa/setup/totp");
      else res.redirect(redirUrl || "/");
    } else {
      req.flash("danger", err);
      res.redirect("/auth/signup");
    }
  });
};
/**
 * @name get/signup_final_ext
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/signup_final_ext",
  error_catcher(async (req, res) => {
    const new_user_form = getState().getConfig("new_user_form");
    if (!req.user || req.user.id || !new_user_form) {
      req.flash("danger", req.__("This is the wrong place"));
      res.redirect("/auth/login");
      return;
    }
    const form = await getNewUserForm(new_user_form, req, !req.user.email);
    form.action = "/auth/signup_final_ext";
    form.values.email = req.user.email;
    res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
  })
);

/**
 * @name post/signup_final_ext
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/signup_final_ext",
  setTenant,
  error_catcher(async (req, res) => {
    const new_user_form = getState().getConfig("new_user_form");
    if (!req.user || req.user.id || !new_user_form) {
      req.flash("danger", req.__("This is the wrong place"));
      res.redirect("/auth/login");
      return;
    }
    const form = await getNewUserForm(new_user_form, req, !req.user.email);
    form.action = "/auth/signup_final_ext";

    await form.asyncValidate(req.body);
    if (form.hasErrors) {
      res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
      return;
    }
    try {
      const uobj = { ...req.user, ...form.values };
      if (uobj.email && !check_email_mask(uobj.email)) {
        form.errors._form = req.__(
          "Signups with this email address are not accepted"
        );
        res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
        return;
      }
      uobj.role_id = +getState().getConfig("signup_role", "80");
      const u = await User.create(uobj);
      await send_verification_email(u, req);

      signup_login_with_user(u, req, res);
    } catch (e) {
      const table = Table.findOne({ name: "users" });
      const fields = table.getFields();
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

/**
 * @name post/signup_final
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/signup_final",
  setTenant,
  error_catcher(async (req, res) => {
    if (getState().getConfig("allow_signup")) {
      const new_user_form = getState().getConfig("new_user_form");
      const form = await getNewUserForm(new_user_form, req);
      const signup_form_name = getState().getConfig("signup_form", "");
      if (signup_form_name) {
        const signup_form = await View.findOne({ name: signup_form_name });
        if (signup_form) {
          signup_form.configuration.columns.forEach((col) => {
            if (
              col.type === "Field" &&
              !["email", "password"].includes(col.field_name)
            ) {
              form.hidden(col.field_name);
            }
          });
        }
      }
      await form.asyncValidate(req.body);
      if (form.hasErrors) {
        res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
      } else if (form.values.email && !check_email_mask(form.values.email)) {
        form.errors._form = req.__(
          "Signups with this email address are not accepted"
        );
        res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
      } else {
        try {
          form.values.role_id = +getState().getConfig("signup_role", "80");
          const u = await User.create(form.values);
          await send_verification_email(u, req);

          signup_login_with_user(u, req, res);
        } catch (e) {
          const table = Table.findOne({ name: "users" });
          const fields = table.getFields();
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

/**
 * @name post/signup
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/signup",
  setTenant,
  error_catcher(async (req, res) => {
    if (!getState().getConfig("allow_signup")) {
      req.flash("danger", req.__("Signups not enabled"));
      res.redirect("/auth/login");
      return;
    }

    const unsuitableEmailPassword = async (urecord) => {
      const { email, password, passwordRepeat } = urecord;
      if (email == "" || !password) {
        req.flash("danger", req.__("E-mail and password required"));
        res.redirect("/auth/signup");
        return true;
      }
      if (email && email.length > 127) {
        req.flash("danger", req.__("E-mail too long"));
        res.redirect("/auth/signup");
        return true;
      }
      if (email && !User.valid_email(email)) {
        req.flash("danger", req.__("Not a valid e-mail address"));
        res.redirect("/auth/signup");
        return true;
      }
      if (!check_email_mask(email)) {
        req.flash(
          "danger",
          req.__("Signups with this email address are not accepted")
        );
        res.redirect("/auth/signup");
        return true;
      }
      if (typeof passwordRepeat === "string" && password !== passwordRepeat) {
        req.flash("danger", req.__("Passwords do not match"));
        res.redirect("/auth/signup");
        return true;
      }
      if (await User.matches_existing_user(urecord)) {
        req.flash("danger", req.__("Account already exists"));
        res.redirect("/auth/signup");
        return true;
      }
      const pwcheck = User.unacceptable_password_reason(password);
      if (pwcheck) {
        req.flash("danger", pwcheck);
        res.redirect("/auth/signup");
        return true;
      }
      let constraint_check_error = User.table.check_table_constraints(urecord);
      if (constraint_check_error) {
        req.flash("danger", constraint_check_error);
        res.redirect("/auth/signup");
        return true;
      }
    };
    const new_user_form = getState().getConfig("new_user_form");

    const signup_form_name = getState().getConfig("signup_form", "");
    if (signup_form_name) {
      const signup_view = await View.findOne({ name: signup_form_name });
      if (signup_view) {
        const signup_form = await getForm(
          Table.findOne({ name: "users" }),
          signup_form_name,
          signup_view.configuration.columns,
          signup_view.configuration.layout,
          undefined,
          req,
          false
        );
        await signup_form.asyncValidate(req.body);
        if (signup_form.hasErrors) {
          signup_form.action = "/auth/signup";
          res.sendAuthWrap(
            req.__(`Sign up`),
            signup_form,
            getAuthLinks("signup")
          );
          return;
        }
        //ensure pw repeat is set if used.
        signup_form.fields.forEach((f) => {
          if (f.name === "passwordRepeat")
            signup_form.values[f.name] = signup_form.values[f.name] || "";
        });
        const userObject = signup_form.values;
        //const { email, password, passwordRepeat } = userObject;
        if (await unsuitableEmailPassword(userObject)) return;
        const new_user_form_form = await getNewUserForm(new_user_form, req);
        if (new_user_form_form) {
          Object.entries(userObject).forEach(([k, v]) => {
            new_user_form_form.values[k] = v;
            if (!new_user_form_form.fields.find((f) => f.name === k))
              new_user_form_form.hidden(k);
          });
          res.sendAuthWrap(
            new_user_form,
            new_user_form_form,
            getAuthLinks("signup", true)
          );
        } else {
          userObject.role_id = +getState().getConfig("signup_role", "80");
          const u = await User.create(userObject);
          await send_verification_email(u, req);

          signup_login_with_user(
            u,
            req,
            res,
            new_user_form && !new_user_form_form
              ? `/view/${new_user_form}?id=${u.id}`
              : undefined
          );
        }
        return;
      }
    }

    const form = await default_signup_form(req);
    await form.asyncValidate(req.body);

    if (form.hasErrors) {
      form.action = "/auth/signup";
      form.submitLabel = req.__("Sign up");
      res.sendAuthWrap(req.__(`Sign up`), form, getAuthLinks("signup"));
    } else {
      const { email, password } = form.values;
      if (await unsuitableEmailPassword({ email, password })) return;
      if (new_user_form) {
        const form = await getNewUserForm(new_user_form, req);
        form.values.email = email;
        form.values.password = password;
        res.sendAuthWrap(new_user_form, form, getAuthLinks("signup", true));
      } else {
        form.values.role_id = +getState().getConfig("signup_role", "80");
        const u = await User.create(form.values);
        await send_verification_email(u, req);
        if (req.smr)
          await loginWithJwt(
            email,
            password,
            req.headers["x-saltcorn-app"],
            res,
            req
          );
        else signup_login_with_user(u, req, res);
      }
    }
  })
);

/**
 * @param {object} req
 * @param {object} res
 * @returns {void}
 */
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

/**
 * try to find a unique user id in login submit
 * @param {object} body
 * @returns {string}
 */
const userIdKey = (body) => {
  if (body.email) return body.email;
  const { remember, password, _csrf, passwordRepeat, ...rest } = body;
  const kvs = Object.entries(rest);
  if (kvs.length > 0) return kvs[0][1];
  else return "nokey";
};
const ipLimiter = rateLimit({
  // TBD create config parameter
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  handler,
});

const userLimiter = rateLimit({
  // TBD create config parameter
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limit each IP to 100 requests per windowMs
  keyGenerator: (req) => userIdKey(req.body),
  handler,
});

function setOldSessionID(req, res, next) {
  req.old_session_id = getSessionId(req);
  next();
}

/**
 * POST /auth/login
 * @name post/login
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/login",
  ipLimiter,
  userLimiter,
  setOldSessionID,
  passport.authenticate("local", {
    //successRedirect: "/",
    failureRedirect: "/auth/login",
    failureFlash: true,
  }),
  error_catcher(async (req, res) => {
    ipLimiter.resetKey(req.ip);
    userLimiter.resetKey(userIdKey(req.body));
    if (req.user.pending_user) {
      res.redirect("/auth/twofa/login/totp");
      return;
    }
    if (req.session.cookie)
      if (req.body.remember) {
        const setDur = +getState().getConfig("cookie_duration_remember", 0);
        if (setDur) req.session.cookie.maxAge = setDur * 60 * 60 * 1000;
        else req.session.cookie.expires = false;
      } else {
        const setDur = +getState().getConfig("cookie_duration", 0);
        if (setDur) req.session.cookie.maxAge = setDur * 60 * 60 * 1000;
        else req.session.cookie.expires = false;
      }
    const session_id = getSessionId(req);

    Trigger.emitEvent("Login", null, req.user, {
      session_id,
      old_session_id: req.old_session_id,
    });
    res?.cookie?.("loggedin", "true");
    req.flash("success", req.__("Welcome, %s!", req.user.email));
    if (req.smr) {
      const dbUser = await User.findOne({ id: req.user.id });
      if (!dbUser.last_mobile_login)
        await dbUser.updateLastMobileLogin(new Date());
    }
    if (getState().get2FApolicy(req.user) === "Mandatory") {
      res.redirect("/auth/twofa/setup/totp");
    } else if (req.body.dest && is_relative_url(req.body.dest)) {
      res.redirect(decodeURIComponent(req.body.dest));
    } else res.redirect("/");
  })
);

/**
 * @name get/login-with/:method
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/login-with/:method",
  error_catcher(async (req, res, next) => {
    const { method } = req.params;
    if (method === "jwt") {
      const { email, password } = req.query;
      await loginWithJwt(
        email,
        password,
        req.headers["x-saltcorn-app"],
        res,
        req
      );
    } else {
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
    }
  })
);

/*
  returns if 'req.user' is an authenticated user
 */
router.get(
  "/authenticated",
  error_catcher((req, res, next) => {
    const isAuth = req.user && req.user.id ? true : false;
    res.json({ authenticated: isAuth });
  })
);

/**
 * @name post/login-with/:method
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/login-with/:method",
  error_catcher(async (req, res, next) => {
    const { method } = req.params;
    const auth = getState().auth_methods[method];
    if (auth) {
      passport.authenticate(method, auth.parameters)(
        req,
        res,
        loginCallback(req, res)
      );
    } else {
      req.flash(
        "danger",
        req.__("Unknown authentication method %s", text(method))
      );
      res.redirect("/");
    }
  })
);

/**
 * @param {object} req
 * @param {object} res
 * @returns {void}
 */
const loginCallback = (req, res) => () => {
  if (!req.user) return;
  if (!req.user.id) {
    res.redirect("/auth/signup_final_ext");
  }
  if (!req.user.email) {
    res.redirect("/auth/set-email");
  } else {
    Trigger.emitEvent("Login", null, req.user);
    req.flash("success", req.__("Welcome, %s!", req.user.email));
    res.redirect("/");
  }
};

const callbackFn = async (req, res, next) => {
  const { method } = req.params;
  const auth = getState().auth_methods[method];
  if (auth) {
    passport.authenticate(method, { failureRedirect: "/auth/login" })(
      req,
      res,
      loginCallback(req, res)
    );
  }
};

router.get("/callback/:method", error_catcher(callbackFn));

router.post("/callback/:method", error_catcher(callbackFn));

/**
 * @param {object} req
 * @returns {Form}
 */
const changPwForm = (req) =>
  new Form({
    action: "/auth/settings",
    submitLabel: req.__("Change"),
    submitButtonClass: "btn-outline-primary",
    onChange: "remove_outline(this)",
    fields: [
      {
        label: req.__("Old password"),
        name: "password",
        input_type: "password",
        attributes: {
          autocomplete: "current-password",
        },
      },
      {
        label: req.__("New password"),
        name: "new_password",
        input_type: "password",
        attributes: {
          autocomplete: "new-password",
        },
        validator: (pw) => User.unacceptable_password_reason(pw),
      },
    ],
  });

/**
 * @param {object} req
 * @param {object} user
 * @returns {Form}
 */
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
            ...(((user && user.language === locale) ||
              (user && !user.language && req.getLocale() === locale)) && {
              selected: true,
            }),
          },
          language
        )
      )
    )
  );

/**
 * @param {object} opts
 * @param {object} opts.req
 * @param {object} opts.res
 * @param {object} opts.pwform
 * @param {object} opts.user
 * @returns {Promise<object>}
 */
const userSettings = async ({ req, res, pwform, user }) => {
  let usersets, userSetsName;
  const user_settings_form = getState().getConfig("user_settings_form", "");
  if (user_settings_form) {
    const view = await View.findOne({ name: user_settings_form });
    if (view) {
      usersets = await view.run({ id: user.id }, { req, res });
      userSetsName = view.name;
    }
  }
  let apikeycard;
  const min_role_apikeygen = +getState().getConfig("min_role_apikeygen", 1);
  const twoFaPolicy = getState().get2FApolicy(user);
  const show2FAPolicy =
    twoFaPolicy !== "Disabled" || user._attributes.totp_enabled;
  if (user.role_id <= min_role_apikeygen)
    apikeycard = {
      type: "card",
      title: req.__("API token"),
      contents: [
        // api token for user
        div(
          user.api_token
            ? span({ class: "me-1" }, req.__("API token for this user: ")) +
                code(user.api_token)
            : req.__("No API token issued")
        ),
        // button for reset or generate api token
        div(
          { class: "mt-4 d-inline-block" },
          post_btn(
            `/auth/gen-api-token`,
            user.api_token ? req.__("Reset") : req.__("Generate"),
            req.csrfToken()
          )
        ),
        // button for remove api token
        user.api_token &&
          div(
            { class: "mt-4 ms-2 d-inline-block" },
            post_btn(
              `/auth/remove-api-token`,
              // TBD localization
              user.api_token ? req.__("Remove") : req.__("Generate"),
              req.csrfToken(),
              { req: req, confirm: true }
            )
          ),
      ],
    };
  let themeCfgCard;
  const layoutPlugin = getState().getLayoutPlugin(user);
  const modNames = getState().plugin_module_names;
  const pluginName = layoutPlugin.plugin_name;
  let safeName = pluginName;
  for (const [k, v] of Object.entries(modNames)) {
    if (v === pluginName) safeName = k;
  }

  const hasUserConfigs =
    layoutPlugin.user_config_form &&
    (await layoutPlugin.user_config_form(
      getState().plugin_cfgs[pluginName] || {}
    )) !== null;
  themeCfgCard = {
    type: "card",
    title: req.__("Layout"),
    contents: [
      div(
        hasUserConfigs
          ? req.__("Adjust the the theme for this user")
          : req.__("The current theme has no user specific settings")
      ),
      hasUserConfigs
        ? div(
            {
              class: "mt-4",
            },

            a(
              {
                class: "btn btn-primary",
                role: "button",
                href: `/plugins/user_configure/${encodeURIComponent(safeName)}`,
                title: req.__("Configure theme"),
              },
              req.__("Configure")
            ),
            button(
              {
                class: "btn btn-primary ms-2",
                onclick: "ajax_post('/plugins/remove_user_layout')",
                title: req.__("Remove all user specific theme settings"),
              },
              req.__("Reset")
            )
          )
        : "",
    ],
  };

  return {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [{ text: req.__("User") }, { text: req.__("Settings") }],
      },
      ...(usersets
        ? [
            {
              type: "card",
              class: "mt-0",
              title: userSetsName,
              contents: usersets,
            },
          ]
        : []),
      {
        type: "card",
        title: req.__("User"),
        class: !usersets && "mt-0",
        contents: table(
          tbody(
            tr(
              th(req.__("Email: ")),
              td(a({ href: "mailto:" + req.user.email }, req.user.email))
            ),
            tr(th(req.__("Language: ")), td(setLanguageForm(req, user)))
          )
        ),
      },
      ...(user.password
        ? [
            {
              type: "card",
              title: req.__("Change password"),
              contents: renderForm(pwform, req.csrfToken()),
            },
          ]
        : []),
      ...(user.password && show2FAPolicy
        ? [
            {
              type: "card",
              title: req.__("Two-factor authentication"),
              contents: [
                div(
                  user._attributes.totp_enabled
                    ? req.__("Two-factor authentication is enabled")
                    : req.__("Two-factor authentication is disabled")
                ),
                div(
                  user._attributes.totp_enabled
                    ? a(
                        {
                          href: "/auth/twofa/disable/totp",
                          class: "btn btn-danger mt-2",
                        },
                        req.__("Disable 2FA")
                      )
                    : a(
                        {
                          href: "/auth/twofa/setup/totp",
                          class: "btn btn-primary mt-2",
                        },
                        req.__("Enable 2FA")
                      )
                ),
              ],
            },
          ]
        : []),
      ...(apikeycard ? [apikeycard] : []),
      ...(themeCfgCard ? [themeCfgCard] : []),
    ],
  };
};
/**
 * Get new api token
 * @name post/gen-api-token/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/gen-api-token",
  error_catcher(async (req, res) => {
    const min_role_apikeygen = +getState().getConfig("min_role_apikeygen", 1);
    if (req.user.role_id <= min_role_apikeygen) {
      const u = await User.findOne({ id: req.user.id });
      await u.getNewAPIToken();
      req.flash("success", req.__(`New API token generated`));
    }
    res.redirect(`/auth/settings`);
  })
);

/**
 * Remove api token
 * @name post/remove-api-token/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/remove-api-token",
  error_catcher(async (req, res) => {
    const min_role_apikeygen = +getState().getConfig("min_role_apikeygen", 1);
    if (req.user.role_id <= min_role_apikeygen) {
      const u = await User.findOne({ id: req.user.id });
      await u.removeAPIToken();
      req.flash("success", req.__(`API token removed`));
    }
    res.redirect(`/auth/settings`);
  })
);
/**
 * Set language
 * @name post/setlanguage
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/setlanguage",
  loggedIn,
  error_catcher(async (req, res) => {
    const u = await User.findForSession({ id: req.user.id });
    const newlang = available_languages[req.body.locale];
    if (newlang && u) {
      await u.set_language(req.body.locale);
      req.login(u.session_object, function (err) {
        if (!err) {
          req.flash("success", req.__("Language changed to %s", newlang));
          res.redirect("/auth/settings");
        } else {
          req.flash("danger", err);
          res.redirect("/auth/settings");
        }
      });
    } else {
      req.flash("danger", req.__("Language not found"));
      res.redirect("/auth/settings");
    }
  })
);

/**
 * @name get/settings
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/settings",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      req.logout(() => {
        req.flash("danger", req.__("Must be logged in first"));
        res.redirect("/auth/login");
      });
    } else
      res.sendWrap(
        req.__("User settings") || "User settings",
        await userSettings({ req, res, pwform: changPwForm(req), user })
      );
  })
);

/**
 * Define set email form for user
 * @param {object} req
 * @returns {Form}
 */
const setEmailForm = (req) =>
  new Form({
    action: "/auth/set-email",
    blurb: req.__("Please enter your email address"),
    fields: [
      {
        name: "email",
        label: req.__("Email"),
        type: "String",
        attributes: {
          input_type: "email",
        },
        required: true,
      },
    ],
  });

/**
 * Render form for set email for user
 * @name get/set-email
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/set-email",
  error_catcher(async (req, res) => {
    res.sendWrap(
      req.__("Set Email"),
      renderForm(setEmailForm(req), req.csrfToken())
    );
  })
);

/**
 * Execute set email for user
 * @name post/set-email
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/set-email",
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

    const u = await User.findForSession({ id: req.user.id });
    await u.update({ email: form.values.email });
    u.email = form.values.email;
    req.login(u.session_object, function (err) {
      if (!err) {
        Trigger.emitEvent("Login", null, u);
        req.flash("success", req.__("Welcome, %s!", u.email));
        res.redirect("/");
      } else {
        req.flash("danger", err);
        res.redirect("/");
      }
    });
  })
);

/**
 * Execute Change Password for User
 * @name post/settings
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.post(
  "/settings",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user?.id });
    if (!user) {
      res.sendWrap(
        req.__("User settings") || "User settings",
        "Must be logged in"
      );
      return;
    }
    if (req.body.new_password && user.password) {
      const pwform = changPwForm(req);

      pwform.fields[0].validator = (oldpw) => {
        const cmp = user.checkPassword(oldpw);
        if (cmp) return true;
        else return req.__("Password does not match");
      };

      pwform.validate(req.body);

      if (pwform.hasErrors) {
        res.sendWrap(
          req.__("User settings"),
          await userSettings({ req, res, pwform, user })
        );
      } else {
        await user.changePasswordTo(pwform.values.new_password);
        req.flash("success", req.__("Password changed"));
        res.redirect("/auth/settings");
      }
    } else {
      const user_settings_form = getState().getConfig("user_settings_form", "");
      if (user_settings_form) {
        const view = await View.findOne({ name: user_settings_form });
        if (view) {
          const fakeRes = {
            status() {},
            sendWrap() {},
            json() {},
            redirect() {},
          };
          await view.runPost({ id: user.id }, req.body, {
            req,
            res: fakeRes,
            redirect: "/auth/settings",
          });
          const u = await User.findForSession({ id: user.id });
          req.login(u.session_object, function (err) {
            if (err) req.flash("danger", err);
            else req.flash("success", req.__("User settings changed"));

            res.redirect("/auth/settings");
          });
        }
      } else {
        res.redirect("/auth/settings");
      }
    }
  })
);

/**
 * @name all/verification-flow
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.all(
  "/verification-flow",
  loggedIn,
  error_catcher(async (req, res) => {
    const verifier = await (getState().verifier || (() => null))(req.user);
    if (!verifier) {
      res.redirect("/");
      return;
    }
    verifier.action = "/auth/verification-flow";
    const wfres = await verifier.run(req.body || {}, req);
    if (wfres.flash) req.flash(wfres.flash[0], wfres.flash[1]);
    if (wfres.renderForm) {
      res.sendWrap(
        req.__(`Account verification`),
        renderForm(wfres.renderForm, req.csrfToken())
      );
      return;
    }
    if (wfres.verified === true) {
      const user = await User.findForSession({ id: req.user.id });
      await user.set_to_verified();
      req.flash("success", req.__("User verified"));
      await user.relogin(req);
    }
    if (wfres.verified === false) {
      req.flash("danger", req.__("User verification failed"));
      res.redirect(wfres.redirect || "/auth/verification-flow");
      return;
    }
    res.redirect(wfres.redirect || "/");
  })
);

/**
 * @name get/settings
 * @function
 * @memberof module:auth/routes~routesRouter
 */
router.get(
  "/twofa/setup/totp",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    let key;
    if (user._attributes.totp_key) key = user._attributes.totp_key;
    else {
      key = randomKey(10);
      user._attributes.totp_key = key;
      await user.update({ _attributes: user._attributes });
    }

    const encodedKey = base32.encode(key);

    // generate QR code for scanning into Google Authenticator
    // reference: https://code.google.com/p/google-authenticator/wiki/KeyUriFormat
    const site_name = getState().getConfig("site_name");
    const otpUrl = `otpauth://totp/${
      user.email
    }?secret=${encodedKey}&period=30&issuer=${encodeURIComponent(site_name)}`;
    const image = await qrcode.toDataURL(otpUrl);
    res.sendWrap(req.__("Setup two-factor authentication"), {
      type: "card",
      title: req.__(
        "Setup two-factor authentication with Time-based One-Time Password (TOTP)"
      ),
      contents: [
        h4(req.__("1. Scan this QR code in your Authenticator app")),
        img({ src: image }),
        p(req.__("Or enter this code:")),
        code(pre(encodedKey.toString())),
        h4(
          req.__(
            "2. Enter the six-digit code generated in your Authenticator app"
          )
        ),
        renderForm(totpForm(req), req.csrfToken()),
      ],
    });
  })
);

router.post(
  "/twofa/setup/totp",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user.id });

    if (!user._attributes.totp_key) {
      //key not set
      req.flash("danger", req.__("2FA TOTP Key not set"));
      console.log("2FA TOTP Key not set");
      res.redirect("/auth/twofa/setup/totp");
      return;
    }

    const form = totpForm(req);
    form.validate(req.body);
    if (form.hasErrors) {
      req.flash("danger", req.__("Error processing form"));
      console.log("Error processing form");

      res.redirect("/auth/twofa/setup/totp");
      return;
    }
    const code = `${form.values.totpCode}`;
    const rv = totp.verify(code, user._attributes.totp_key, {
      time: 30,
    });
    if (!rv) {
      req.flash("danger", req.__("Could not verify code"));
      console.log("Could not verify code");
      res.redirect("/auth/twofa/setup/totp");
      return;
    }
    console.log("TOTP return ", rv);
    user._attributes.totp_enabled = true;
    await user.update({ _attributes: user._attributes });
    req.flash(
      "success",
      req.__(
        "Two-factor authentication with Time-based One-Time Password enabled"
      )
    );

    res.redirect("/auth/settings");
  })
);
/**
 * GET /twofa/disable/totp
 */
router.get(
  "/twofa/disable/totp",
  loggedIn,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__("Disable two-factor authentication"), {
      type: "card",
      title: req.__("Disable two-factor authentication"),
      contents: [
        h4(req.__("Enter your two-factor code in order to disable it")),
        renderForm(totpForm(req, "/auth/twofa/disable/totp"), req.csrfToken()),
      ],
    });
  })
);
/**
 * POST /twofa/disable/totp
 * Disable TWA
 */
router.post(
  "/twofa/disable/totp",
  loggedIn,
  error_catcher(async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    const form = totpForm(req, "/auth/twofa/disable/totp");
    form.validate(req.body);
    if (form.hasErrors) {
      req.flash("danger", req.__("Error processing form"));
      res.redirect("/auth/twofa/disable/totp");
      return;
    }
    const code = `${form.values.totpCode}`;
    const rv = totp.verify(code, user._attributes.totp_key, {
      time: 30,
    });
    if (!rv) {
      req.flash("danger", req.__("Could not verify code"));
      res.redirect("/auth/twofa/disable/totp");
      return;
    }
    user._attributes.totp_enabled = false;
    delete user._attributes.totp_key;
    await user.update({ _attributes: user._attributes });
    req.flash(
      "success",
      req.__(
        "Two-factor authentication with Time-based One-Time Password disabled"
      )
    );
    res.redirect("/auth/settings");
  })
);
/**
 * totpForm (TWA)
 * @param {*} req
 * @param {*} action
 * @returns
 */
const totpForm = (req, action) =>
  new Form({
    action: action || "/auth/twofa/setup/totp",
    fields: [
      {
        name: "totpCode",
        label: req.__("Code"),
        type: "Integer",
        attributes: {
          type: "text",
          inputmode: "numeric",
          pattern: "[0-9]*",
          autocomplete: "one-time-code",
        },
        required: true,
      },
    ],
  });
/**
 * Random key generation for totp (TWA)
 * @param {*} len
 * @returns
 */
const randomKey = function (len) {
  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  var buf = [],
    chars = "abcdefghijklmnopqrstuvwxyz0123456789",
    charlen = chars.length;

  for (let i = 0; i < len; ++i) {
    buf.push(chars[getRandomInt(0, charlen - 1)]);
  }

  return buf.join("");
};
/**
 * GET /twofa/login/totp
 */
router.get(
  "/twofa/login/totp",
  error_catcher(async (req, res) => {
    const form = new Form({
      action: "/auth/twofa/login/totp",
      submitLabel: "Verify",
      blurb: req.__(
        "Please enter the two-factor authetication code from your authenticator device"
      ),
      fields: [
        {
          name: "code",
          label: req.__("Code"),
          type: "Integer",
          attributes: {
            type: "text",
            inputmode: "numeric",
            pattern: "[0-9]*",
            autocomplete: "one-time-code",
            autofocus: true,
          },
          required: true,
        },
      ],
    });
    res.sendAuthWrap(req.__(`Two-factor authentication`), form, {});
  })
);
/**
 * POST /twofa/login/totp
 */
router.post(
  "/twofa/login/totp",
  passport.authenticate("totp", {
    failureRedirect: "/auth/twofa/login/totp",
    failureFlash: true,
  }),
  error_catcher(async (req, res) => {
    const user = await User.findForSession({ id: req.user.pending_user.id });
    await user.relogin(req);
    Trigger.emitEvent("Login", null, user);
    res.redirect("/");
  })
);
