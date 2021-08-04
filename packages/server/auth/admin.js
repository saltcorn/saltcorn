/**
 * Auth / Admin
 * @type {module:express-promise-router}
 */
// todo refactor to few modules + rename to be in sync with router url
const Router = require("express-promise-router");
const { contract, is } = require("contractis");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const View = require("@saltcorn/data/models/view");
const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  settingsDropdown,
  post_dropdown_item,
} = require("@saltcorn/markup");
const { isAdmin, setTenant, error_catcher } = require("../routes/utils");
const { send_reset_email } = require("./resetpw");
const { getState } = require("@saltcorn/data/db/state");
const { a, div, text, span, code, h5, i, p } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const {
  send_users_page,
  config_fields_form,
  save_config_from_form,
  getBaseDomain,
  hostname_matches_baseurl,
  is_hsts_tld,
} = require("../markup/admin");
const { send_verification_email } = require("@saltcorn/data/models/email");
const router = new Router();
module.exports = router;

const getUserFields = async (req) => {
  const userTable = await Table.findOne({ name: "users" });
  const userFields = (await userTable.getFields()).filter(
    (f) => !f.calculated && f.name !== "id"
  );
  //console.log("userFields:",userFields);
  const iterForm = async (cfgField) => {
    const signup_form_name = getState().getConfig(cfgField, "");
    if (signup_form_name) {
      const signup_form = await View.findOne({ name: signup_form_name });
      if (signup_form) {
        (signup_form.configuration.columns || []).forEach((f) => {
          const uf = userFields.find((uff) => uff.name === f.field_name);
          if (uf) {
            uf.fieldview = f.fieldview;
            uf.attributes = { ...f.configuration, ...uf.attributes };
          }
        });
      }
    }
  };
  await iterForm("signup_form");
  await iterForm("new_user_form");
  for (const f of userFields) {
    if (f.name === "email") {
      f.validator = (s) => {
        if (!User.valid_email(s)) return req.__("Not a valid e-mail address");
      };
    }
  }
  return userFields;
};
/**
 * User Form
 * @type {*|(function(...[*]=): *)}
 */
const userForm = contract(
  is.fun(
    [is.obj({}), is.maybe(is.class("User"))],
    is.promise(is.class("Form"))
  ),
  async (req, user) => {
    const roleField = new Field({
      label: req.__("Role"),
      name: "role_id",
      type: "Key",
      reftable_name: "roles",
    });
    const roles = (await User.get_roles()).filter((r) => r.role !== "public");
    roleField.options = roles.map((r) => ({ label: r.role, value: r.id }));
    const can_reset = getState().getConfig("smtp_host", "") !== "";
    const userFields = await getUserFields(req);
    const form = new Form({
      fields: [roleField, ...userFields],
      action: "/useradmin/save",
      submitLabel: user ? req.__("Save") : req.__("Create"),
    });
    if (!user) {
      form.fields.push(
        new Field({
          label: req.__("Set random password"),
          name: "rnd_password",
          type: "Bool",
          default: true,
        })
      );
      form.fields.push(
        new Field({
          label: req.__("Password"),
          name: "password",
          input_type: "password",
          showIf: { rnd_password: false },
        })
      );
      can_reset &&
        form.fields.push(
          new Field({
            label: req.__("Send password reset email"),
            name: "send_pwreset_email",
            type: "Bool",
            default: true,
            showIf: { rnd_password: true },
          })
        );
    }
    if (user) {
      form.hidden("id");
      form.values = user;
      delete form.values.password;
    } else {
      form.values.role_id = roles[roles.length - 1].id;
    }
    return form;
  }
);
/**
 * Dropdown for User Info in left menu
 * @param user
 * @param req
 * @param can_reset
 * @returns {string}
 */
const user_dropdown = (user, req, can_reset) =>
  settingsDropdown(`dropdownMenuButton${user.id}`, [
    a(
      {
        class: "dropdown-item",
        href: `/useradmin/${user.id}`,
      },
      '<i class="fas fa-edit"></i>&nbsp;' + req.__("Edit")
    ),
    post_dropdown_item(
      `/useradmin/set-random-password/${user.id}`,
      '<i class="fas fa-random"></i>&nbsp;' + req.__("Set random password"),
      req
    ),
    can_reset &&
      post_dropdown_item(
        `/useradmin/reset-password/${user.id}`,
        '<i class="fas fa-envelope"></i>&nbsp;' +
          req.__("Send password reset email"),
        req
      ),
    can_reset &&
      !user.verified_on &&
      getState().getConfig("verification_view", "") &&
      post_dropdown_item(
        `/useradmin/send-verification/${user.id}`,
        '<i class="fas fa-envelope"></i>&nbsp;' +
          req.__("Send verification email"),
        req
      ),
    user.disabled &&
      post_dropdown_item(
        `/useradmin/enable/${user.id}`,
        '<i class="fas fa-play"></i>&nbsp;' + req.__("Enable"),
        req
      ),
    !user.disabled &&
      post_dropdown_item(
        `/useradmin/disable/${user.id}`,
        '<i class="fas fa-pause"></i>&nbsp;' + req.__("Disable"),
        req
      ),
    div({ class: "dropdown-divider" }),
    post_dropdown_item(
      `/useradmin/delete/${user.id}`,
      '<i class="far fa-trash-alt"></i>&nbsp;' + req.__("Delete"),
      req,
      true,
      user.email
    ),
  ]);

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const users = await User.find({}, { orderBy: "id" });
    const roles = await User.get_roles();
    var roleMap = {};
    roles.forEach((r) => {
      roleMap[r.id] = r.role;
    });
    const can_reset = getState().getConfig("smtp_host", "") !== "";
    send_users_page({
      res,
      req,
      active_sub: "Users",
      contents: {
        type: "card",
        title: req.__("Users"),
        contents: [
          mkTable(
            [
              { label: req.__("ID"), key: "id" },
              {
                label: req.__("Email"),
                key: (r) => link(`/useradmin/${r.id}`, r.email),
              },
              {
                label: "",
                key: (r) =>
                  r.disabled
                    ? span({ class: "badge badge-danger" }, "Disabled")
                    : "",
              },
              {
                label: req.__("Verified"),
                key: (r) =>
                  !!r.verified_on
                    ? i({
                        class: "fas fa-check-circle text-success",
                      })
                    : "",
              },
              { label: req.__("Role"), key: (r) => roleMap[r.role_id] },
              {
                label: "",
                key: (r) => user_dropdown(r, req, can_reset),
              },
            ],
            users,
            { hover: true }
          ),
          link(`/useradmin/new`, req.__("Create user")),
        ],
      },
    });
  })
);
/**
 * Send User Form for create new User
 */
router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await userForm(req);
    send_users_page({
      res,
      req,
      active_sub: "Users",
      sub2_page: "New",
      contents: {
        type: "card",
        title: req.__("New user"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

const user_settings_form = (req) =>
  config_fields_form({
    req,
    field_names: [
      "allow_signup",
      "login_menu",
      "new_user_form",
      "login_form",
      "signup_form",
      "user_settings_form",
      "verification_view",
      "elevate_verified",
      "min_role_upload",
      "timeout",
      "email_mask",
      "allow_forgot",
      "cookie_sessions",
      "custom_http_headers",
    ],
    action: "/useradmin/settings",
    submitLabel: req.__("Save"),
  });
router.get(
  "/settings",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await user_settings_form(req);
    send_users_page({
      res,
      req,
      active_sub: "Settings",
      contents: {
        type: "card",
        title: req.__("Authentication settings"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);
router.post(
  "/settings",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await user_settings_form(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_users_page({
        res,
        req,
        active_sub: "Settings",
        contents: {
          type: "card",
          title: req.__("Authentication settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);
      req.flash("success", req.__("User settings updated"));
      res.redirect("/useradmin/settings");
    }
  })
);

router.get(
  "/ssl",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    if (!isRoot) {
      req.flash(
        "warning",
        req.__("SSL settings not available for subdomain tenants")
      );
      res.redirect("/useradmin");
      return;
    }
    // TBD describe logic around letsencrypt
    const letsencrypt = getState().getConfig("letsencrypt", false);
    const has_custom =
      getState().getConfig("custom_ssl_certificate", false) &&
      getState().getConfig("custom_ssl_private_key", false);
    const show_warning =
      !hostname_matches_baseurl(req, getBaseDomain()) &&
      is_hsts_tld(getBaseDomain());
    send_users_page({
      res,
      req,
      active_sub: "SSL",
      contents: {
        above: [
          ...(letsencrypt && has_custom
            ? [
                {
                  type: "card",
                  contents: p(
                    req.__(
                      "You have enabled both Let's Encrypt certificates and custom SSL certificates. Let's Encrypt takes priority and the custom certificates will be ignored."
                    )
                  ),
                },
              ]
            : []),
          {
            type: "card",
            title: req.__(
              "HTTPS encryption with Let's Encrypt SSL certificate"
            ),
            contents: [
              p(
                req.__(
                  `Saltcorn can automatically obtain an SSL certificate from <a href="https://letsencrypt.org/">Let's Encrypt</a> for single domains`
                )
              ),
              h5(
                req.__("Currently: "),
                letsencrypt
                  ? span({ class: "badge badge-primary" }, req.__("Enabled"))
                  : span({ class: "badge badge-secondary" }, req.__("Disabled"))
              ),
              letsencrypt
                ? post_btn(
                    "/config/delete/letsencrypt",
                    req.__("Disable LetsEncrypt HTTPS"),
                    req.csrfToken(),
                    { btnClass: "btn-danger", req }
                  )
                : post_btn(
                    "/admin/enable-letsencrypt",
                    req.__("Enable LetsEncrypt HTTPS"),
                    req.csrfToken(),
                    { confirm: true, req }
                  ),
              !letsencrypt &&
                show_warning &&
                !has_custom &&
                div(
                  { class: "mt-3 alert alert-danger" },
                  p(
                    req.__(
                      "The address you are using to reach Saltcorn does not match the Base URL."
                    )
                  ),
                  p(
                    req.__(
                      "The DNS A records (for * and @, or a subdomain) should point to this server's IP address before enabling LetsEncrypt"
                    )
                  )
                ),
            ],
          },
          {
            type: "card",
            title: req.__("HTTPS encryption with custom SSL certificate"),
            contents: [
              p(
                req.__(
                  `Or use custom SSL certificates, including wildcard certificates for multitenant applications`
                )
              ),
              h5(
                req.__("Currently: "),
                has_custom
                  ? span({ class: "badge badge-primary" }, req.__("Enabled"))
                  : span({ class: "badge badge-secondary" }, req.__("Disabled"))
              ),
              // TBD change to button
              link(
                "/useradmin/ssl/custom",
                req.__("Edit custom SSL certificates")
              ),
            ],
          },
        ],
      },
    });
  })
);

const ssl_form = (req) =>
  config_fields_form({
    req,
    field_names: ["custom_ssl_certificate", "custom_ssl_private_key"],
    action: "/useradmin/ssl/custom",
  });
router.get(
  "/ssl/custom",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await ssl_form(req);
    send_users_page({
      res,
      req,
      active_sub: "Settings",
      contents: {
        type: "card",
        title: req.__("Authentication settings"),
        sub2_page: req.__("Custom SSL certificates"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);
router.post(
  "/ssl/custom",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await ssl_form(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_users_page({
        res,
        req,
        active_sub: "Settings",
        contents: {
          type: "card",
          title: req.__("Authentication settings"),
          sub2_page: req.__("Custom SSL certificates"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);
      req.flash(
        "success",
        req.__("Custom SSL enabled. Restart for changes to take effect.") +
          " " +
          a({ href: "/admin/system" }, req.__("Restart here"))
      );
      res.redirect("/useradmin/ssl");
    }
  })
);
router.get(
  "/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const user = await User.findOne({ id });
    const form = await userForm(req, user);

    send_users_page({
      res,
      req,
      active_sub: "Users",
      sub2_page: user.email,
      contents: {
        above: [
          {
            type: "card",
            title: req.__("Edit user %s", user.email),
            contents: renderForm(form, req.csrfToken()),
          },
          {
            type: "card",
            title: req.__("API token"),
            contents: [
              // api token for user
              div(
                user.api_token
                  ? span(
                      { class: "mr-1" },
                      req.__("API token for this user: ")
                    ) + code(user.api_token)
                  : req.__("No API token issued")
              ),
              // button for reset or generate api token
              div(
                { class: "mt-4" },
                post_btn(
                  `/useradmin/gen-api-token/${user.id}`,
                  user.api_token ? req.__("Reset") : req.__("Generate"),
                  req.csrfToken()
                )
              ),
              // button for remove api token
              user.api_token &&
                div(
                  { class: "mt-4" },
                  post_btn(
                    `/useradmin/remove-api-token/${user.id}`,
                    // TBD localization
                    user.api_token ? req.__("Remove") : req.__("Generate"),
                    req.csrfToken(),
                    { req: req, confirm: true }
                  )
                ),
            ],
          },
        ],
      },
    });
  })
);
/**
 * Save user data
 */
router.post(
  "/save",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    let form, sub2;
    if (req.body.id) {
      const user = await User.findOne({ id: req.body.id });
      form = await userForm(req, user);
      sub2 = user.email;
    } else {
      form = await userForm(req);
      sub2 = "New";
    }
    form.validate(req.body);
    if (form.hasErrors) {
      send_users_page({
        res,
        req,
        active_sub: "Users",
        sub2_page: sub2,
        contents: {
          type: "card",
          title: req.__("Edit user"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
      return;
    }
    let {
      email,
      password,
      role_id,
      id,
      rnd_password,
      send_pwreset_email,
      _csrf,
      ...rest
    } = form.values;
    if (id) {
      try {
        await db.update("users", { email, role_id, ...rest }, id);
        req.flash("success", req.__(`User %s saved`, email));
      } catch (e) {
        req.flash("error", req.__(`Error editing user: %s`, e.message));
      }
    } else {
      if (rnd_password) password = User.generate_password();
      const u = await User.create({
        email,
        password,
        role_id: +role_id,
        ...rest,
      });
      // refactored to catch user errors errors and stop processing if any errors
      if (u.error) {
        req.flash("error", u.error); // todo change to prompt near field like done for views
        // todo return to create user form
      } else {
        const pwflash =
          rnd_password && !send_pwreset_email
            ? req.__(` with password %s`, code(password))
            : "";

        req.flash("success", req.__(`User %s created`, email) + pwflash);

        if (rnd_password && send_pwreset_email) await send_reset_email(u, req);
      }
    }
    res.redirect(`/useradmin`);
  })
);
/**
 * Reset password for yser
 */
router.post(
  "/reset-password/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await send_reset_email(u, req);
    req.flash("success", req.__(`Reset password link sent to %s`, u.email));

    res.redirect(`/useradmin`);
  })
);
/**
 * Send verification email for user
 */
router.post(
  "/send-verification/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    const result = await send_verification_email(u);
    if (result.error) req.flash("danger", result.error);
    else
      req.flash(
        "success",
        req.__(`Email verification link sent to %s`, u.email)
      );

    res.redirect(`/useradmin`);
  })
);
/**
 * Get new api token
 */
router.post(
  "/gen-api-token/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await u.getNewAPIToken();
    req.flash("success", req.__(`New API token generated`));

    res.redirect(`/useradmin/${u.id}`);
  })
);
/**
 * Remove api token
 */
router.post(
  "/remove-api-token/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await u.removeAPIToken();
    req.flash("success", req.__(`API token removed`));

    res.redirect(`/useradmin/${u.id}`);
  })
);
/**
 * Set random password
 */
router.post(
  "/set-random-password/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    const newpw = User.generate_password();
    await u.changePasswordTo(newpw);
    await u.destroy_sessions();
    req.flash(
      "success",
      req.__(`Changed password for user %s to %s`, u.email, newpw)
    );

    res.redirect(`/useradmin`);
  })
);

router.post(
  "/disable/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await u.update({ disabled: true });
    await u.destroy_sessions();
    req.flash("success", req.__(`Disabled user %s`, u.email));
    res.redirect(`/useradmin`);
  })
);

router.post(
  "/enable/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await u.update({ disabled: false });
    req.flash("success", req.__(`Enabled user %s`, u.email));
    res.redirect(`/useradmin`);
  })
);

router.post(
  "/delete/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await u.delete();
    req.flash("success", req.__(`User %s deleted`, u.email));

    res.redirect(`/useradmin`);
  })
);
