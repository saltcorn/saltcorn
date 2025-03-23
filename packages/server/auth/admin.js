/**
 * Auth / Admin
 * @category server
 * @module auth/admin
 * @subcategory auth
 */
// todo refactor to few modules + rename to be in sync with router url
const Router = require("express-promise-router");
const { contract, is } = require("contractis");
const { X509Certificate } = require("crypto");
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
const { isAdmin, error_catcher } = require("../routes/utils");
const { send_reset_email } = require("./resetpw");
const { getState } = require("@saltcorn/data/db/state");
const {
  a,
  div,
  span,
  code,
  h5,
  i,
  p,
  input,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const {
  send_users_page,
  config_fields_form,
  save_config_from_form,
  getBaseDomain,
  hostname_matches_baseurl,
  is_hsts_tld,
  check_if_restart_required,
} = require("../markup/admin");
const { send_verification_email } = require("@saltcorn/data/models/email");
const { expressionValidator } = require("@saltcorn/data/models/expression");
const router = new Router();
module.exports = router;

/**
 *
 * @param {object} req
 * @returns {Promise<object>}
 */
const getUserFields = async (req) => {
  const userTable = Table.findOne({ name: "users" });
  const userFields = userTable
    .getFields()
    .filter((f) => !f.calculated && f.name !== "id");
  //console.log("userFields:",userFields);
  const iterForm = async (cfgField) => {
    const signup_form_name = getState().getConfig(cfgField, "");
    if (signup_form_name) {
      const signup_form = await View.findOne({ name: signup_form_name });
      if (signup_form) {
        (signup_form.configuration.columns || []).forEach((f) => {
          const uf = userFields.find((uff) => uff.name === f.field_name);
          if (uf) {
            const fvObj = uf.type?.fieldviews?.[uf.fieldview];
            if (fvObj && !fvObj?.fieldview?.unsuitableAsAdminDefault) {
              uf.fieldview = f.fieldview;
              uf.attributes = { ...f.configuration, ...uf.attributes };
            }
          }
        });
      }
    }
  };
  await iterForm("signup_form");
  await iterForm("new_user_form");
  //console.log(userFields);
  for (const f of userFields) {
    if (f.is_fkey && !f.fieldview) {
      f.fieldviewObj = getState().keyFieldviews?.select;
      if (f.fieldviewObj) {
        f.input_type = "fromtype";
        f.fieldview = "select";
      }
    }
    await f.fill_fkey_options();
    if (f.name === "email") {
      f.validator = (s) => {
        if (!User.valid_email(s)) return req.__("Not a valid e-mail address");
      };
      f.attributes = {
        ...(f.attributes || {}),
        input_type: "email",
      };
    }
    if (f.name === "role_id") {
      f.fieldview = "role_select";
      await f.fill_fkey_options();
    }
  }
  return userFields;
};

/**
 * User Form
 * @function
 * @param {object} req
 * @param {User} user
 * @returns {Promise<Form>}
 */
const userForm = async (req, user) => {
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
    fields: userFields,
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
};

/**
 * Dropdown for User Info in left menu
 * @param {object} user
 * @param {object} req
 * @param {boolean} can_reset
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
      `/useradmin/become-user/${user.id}`,
      '<i class="fas fa-ghost"></i>&nbsp;' + req.__("Become user"),
      req
    ),
    post_dropdown_item(
      `/useradmin/set-random-password/${user.id}`,
      '<i class="fas fa-random"></i>&nbsp;' + req.__("Set random password"),
      req,
      true
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
    !user.disabled &&
      post_dropdown_item(
        `/useradmin/force-logout/${user.id}`,
        '<i class="fas fa-sign-out-alt"></i>&nbsp;' + req.__("Force logout"),
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

/**
 * Users List (HTTP Get)
 * @name get
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const auth_methods = getState().auth_methods;
    const userBadges = (user) =>
      span(
        !!user.disabled &&
          span({ class: "badge bg-danger me-1" }, req.__("Disabled")),
        !!user.verified_on &&
          span({ class: "badge bg-success me-1" }, req.__("Verified")),
        Object.entries(auth_methods)
          .filter(
            ([k, v]) =>
              v.setsUserAttribute && user._attributes[v.setsUserAttribute]
          )
          .map(([k, v]) =>
            span({ class: "badge bg-secondary me-1" }, v.label || k)
          )
      );
    const users = await User.find({}, { orderBy: "id" });
    const roles = await User.get_roles();
    let roleMap = {};
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
          div(
            { class: "row mb-3" },
            div(
              { class: "col-sm-6 offset-sm-3" },
              input({
                class: "form-control",
                type: "search",
                "data-filter-table": "table.user-admin",
                placeholder: `🔍 ${req.__("Search")}`,
              })
            )
          ),
          mkTable(
            [
              { label: req.__("ID"), key: "id" },
              {
                label: req.__("Email"),
                key: (r) => link(`/useradmin/${r.id}`, r.email),
              },
              {
                label: "",
                key: userBadges,
              },
              { label: req.__("Role"), key: (r) => roleMap[r.role_id] },
              {
                label: "",
                key: (r) => user_dropdown(r, req, can_reset),
              },
            ],
            users,
            { hover: true, class: "user-admin" }
          ),
          link(`/useradmin/new`, req.__("Create user")),
        ],
      },
    });
  })
);

/**
 * Send User Form for create new User
 * @name get/new
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/new",
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

/**
 * Authentication Setting Form
 * @param {object} req
 * @returns {Form}
 */
const auth_settings_form = async (req) =>
  await config_fields_form({
    req,
    field_names: [
      "allow_signup",
      "login_menu",
      "allow_forgot",
      {
        section_header: req.__("Signup and login views"),
        sublabel: "Login and signup views should be accessible by public users",
      },
      "login_form",
      "signup_form",
      "new_user_form",
      "user_settings_form",
      "verification_view",
      "reset_password_email_view",
      { section_header: req.__("Additional login and signup settings") },
      "logout_url",
      "signup_role",
      "elevate_verified",
      "email_mask",
      "plain_password_triggers",
    ],
    action: "/useradmin/settings",
    submitLabel: req.__("Save"),
  });

/**
 * HTTP Settings Form
 * @param {object} req
 * @returns {Form}
 */
const http_settings_form = async (req) =>
  await config_fields_form({
    req,
    field_names: [
      "timeout",
      "cookie_duration",
      "cookie_duration_remember",
      "cookie_samesite",
      "content_security_policy",
      "cors_enabled",
      "public_cache_maxage",
      "custom_http_headers",
      "cross_domain_iframe",
      "body_limit",
      "url_encoded_limit",
      ...(!db.isSQLite ? ["prune_session_interval"] : []),
    ],
    action: "/useradmin/http",
    submitLabel: req.__("Save"),
  });

/**
 * Permissions Setting Form
 * @param {object} req
 * @returns {Form}
 */
const permissions_settings_form = async (req) =>
  await config_fields_form({
    req,
    field_names: [
      "min_role_upload",
      "min_role_apikeygen",
      "min_role_search",
      {
        section_header: req.__("Development permissions"),
      },
      "min_role_inspect_tables",
      "min_role_edit_tables",
      "min_role_edit_views",
      "min_role_edit_pages",
      "min_role_edit_triggers",
      "min_role_edit_menu",
      "min_role_edit_files",
      "min_role_edit_search",
      "min_role_create_snapshots",
      //hidden            "exttables_min_role_read",
    ],
    action: "/useradmin/permissions",
    submitLabel: req.__("Save"),
  });

/**
 * HTTP GET for /useradmin/settings
 * @name get/settings
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await auth_settings_form(req);
    send_users_page({
      res,
      req,
      active_sub: "Login and Signup",
      contents: {
        type: "card",
        titleAjaxIndicator: true,
        title: req.__("Authentication settings"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * HTTP POST for /useradmin/settings
 * @name post/settings
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await auth_settings_form(req);
    form.validate(req.body || {});
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
      if (!req.xhr) {
        req.flash("success", req.__("Authentication settings updated"));
        res.redirect("/useradmin/settings");
      } else res.json({ success: "ok" });
    }
  })
);

/**
 * HTTP GET for /useradmin/http
 * @name get/settings
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/http",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await http_settings_form(req);
    send_users_page({
      res,
      req,
      active_sub: "HTTP",
      contents: {
        type: "card",
        titleAjaxIndicator: true,
        title: req.__("HTTP settings"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * HTTP POST for /useradmin/http
 * @name post/settings
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/http",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await http_settings_form(req);
    form.validate(req.body || {});
    if (form.hasErrors) {
      send_users_page({
        res,
        req,
        active_sub: "HTTP",
        contents: {
          type: "card",
          title: req.__("HTTP settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      const restart_required = check_if_restart_required(form, req);

      await save_config_from_form(form);

      if (!req.xhr) {
        req.flash("success", req.__("HTTP settings updated"));
        res.redirect("/useradmin/http");
      } else {
        if (restart_required)
          res.json({
            success: "ok",
            notify:
              req.__("Restart required for changes to take effect.") +
              " " +
              a({ href: "/admin/system" }, req.__("Restart here")),
          });
        else res.json({ success: "ok" });
      }
    }
  })
);

/**
 * HTTP GET for /useradmin/permissions
 * @name get/settings
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/permissions",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await permissions_settings_form(req);
    send_users_page({
      res,
      req,
      active_sub: "Permissions",
      contents: {
        type: "card",
        titleAjaxIndicator: true,
        title: req.__("Permissions settings"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * HTTP POST for /useradmin/permissions
 * @name post/settings
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/permissions",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await permissions_settings_form(req);
    form.validate(req.body || {});
    if (form.hasErrors) {
      send_users_page({
        res,
        req,
        active_sub: "Permissions",
        contents: {
          type: "card",
          titleAjaxIndicator: true,
          title: req.__("Permissions settings"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      await save_config_from_form(form);
      if (!req.xhr) {
        req.flash("success", req.__("Permissions settings updated"));
        res.redirect("/useradmin/permissions");
      } else res.json({ success: "ok" });
    }
  })
);

/**
 * HTTP GET for /useradmin/ssl
 * @name get/ssl
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/ssl",
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
    let expiry = "";
    if (has_custom && X509Certificate) {
      const cert = getState().getConfig("custom_ssl_certificate", "");
      const { validTo } = new X509Certificate(cert);
      expiry = div({ class: "me-2" }, "Expires: ", validTo);
    }
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
                ) +
                  ". " +
                  req.__(
                    `To obtain a certificate, the administrator's email address will be shared with Let's Encrypt.`
                  )
              ),
              h5(
                req.__("Currently: "),
                letsencrypt
                  ? span({ class: "badge bg-primary" }, req.__("Enabled"))
                  : span({ class: "badge bg-secondary" }, req.__("Disabled"))
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
                  ? span({ class: "badge bg-primary" }, req.__("Enabled"))
                  : span({ class: "badge bg-secondary" }, req.__("Disabled"))
              ),
              has_custom && expiry,
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

/**
 * SSL Setting form
 * @param {object} req
 * @returns {Form}
 */
const ssl_form = async (req) =>
  await config_fields_form({
    req,
    field_names: ["custom_ssl_certificate", "custom_ssl_private_key"],
    action: "/useradmin/ssl/custom",
  });

/**
 * HTTP GET for /useradmin/ssl/custom
 * @name get/ssl/custom
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/ssl/custom",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await ssl_form(req);
    send_users_page({
      res,
      req,
      active_sub: "SSL",
      contents: {
        type: "card",
        title: req.__("Custom SSL certificates"),
        sub2_page: req.__("Custom SSL certificates"),
        titleAjaxIndicator: true,
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * HTTP POST for /useradmin/ssl/custom
 * @name post/ssl/custom
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/ssl/custom",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await ssl_form(req);
    form.validate(req.body || {});
    if (form.hasErrors) {
      send_users_page({
        res,
        req,
        active_sub: "SSL",
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
      if (!req.xhr) {
        res.redirect("/useradmin/ssl");
      } else res.json({ success: "ok" });
    }
  })
);

/**
 * HTTP GET for /useradmin/table-access
 * @name get/ssl/custom
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/table-access",
  isAdmin,
  error_catcher(async (req, res) => {
    const tables = await Table.find();
    const roleOptions = (await User.get_roles()).map((r) => ({
      value: r.id,
      label: r.role,
    }));

    const contents = [];
    for (const table of tables) {
      if (table.external) continue;
      const fields = table.getFields();
      const ownership_opts = await table.ownership_options();
      const form = new Form({
        action: "/table",
        noSubmitButton: true,
        onChange: "saveAndContinue(this)",
        fields: [
          {
            label: req.__("Ownership field"),
            name: "ownership_field_id",
            sublabel: req.__(
              "The user referred to in this field will be the owner of the row"
            ),
            input_type: "select",
            options: [
              { value: "", label: req.__("None") },
              ...ownership_opts,
              { value: "_formula", label: req.__("Formula") },
            ],
          },
          {
            name: "ownership_formula",
            label: req.__("Ownership formula"),
            validator: expressionValidator,
            type: "String",
            class: "validate-expression",
            sublabel:
              req.__("User is treated as owner if true. In scope: ") +
              ["user", ...fields.map((f) => f.name)]
                .map((fn) => code(fn))
                .join(", "),
            showIf: { ownership_field_id: "_formula" },
          },
          {
            label: req.__("Minimum role to read"),
            sublabel: req.__(
              "User must have this role or higher to read rows from the table, unless they are the owner"
            ),
            name: "min_role_read",
            input_type: "select",
            options: roleOptions,
            attributes: { asideNext: true },
          },
          {
            label: req.__("Minimum role to write"),
            name: "min_role_write",
            input_type: "select",
            sublabel: req.__(
              "User must have this role or higher to edit or create new rows in the table, unless they are the owner"
            ),
            options: roleOptions,
          },
        ],
      });
      form.hidden("id", "name");
      form.values = table;
      if (table.ownership_formula && !table.ownership_field_id)
        form.values.ownership_field_id = "_formula";
      contents.push(
        div(
          h5(a({ href: `/table/${table.id}` }, table.name)),
          renderForm(form, req.csrfToken())
        )
      );
    }
    send_users_page({
      res,
      req,
      active_sub: "Table access",
      contents: {
        type: "card",
        title: req.__("Table access"),
        titleAjaxIndicator: true,
        contents,
      },
    });
  })
);

/**
 * @name get/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.get(
  "/:id",
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
                      { class: "me-1" },
                      req.__("API token for this user: ")
                    ) + code(user.api_token)
                  : req.__("No API token issued")
              ),
              // button for reset or generate api token
              div(
                { class: "mt-4 d-inline-block" },
                post_btn(
                  `/useradmin/gen-api-token/${user.id}`,
                  user.api_token ? req.__("Reset") : req.__("Generate"),
                  req.csrfToken()
                )
              ),
              // button for remove api token
              user.api_token &&
                div(
                  { class: "mt-4 ms-2 d-inline-block" },
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
 * @name post/save
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/save",
  isAdmin,
  error_catcher(async (req, res) => {
    let form, sub2;
    if ((req.body || {}).id) {
      const user = await User.findOne({ id: (req.body || {}).id });
      form = await userForm(req, user);
      sub2 = user.email;
    } else {
      form = await userForm(req);
      sub2 = "New";
    }
    form.validate(req.body || {});
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
        const u = await User.findOne({ id });
        await u.update({ email, role_id, ...rest });
        req.flash("success", req.__(`User %s saved`, email));
      } catch (e) {
        console.error(e);
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
      // refactored to catch user errors and stop processing if any errors
      if (u.error) {
        req.flash("error", u.error); // todo change to prompt near field like done for views
        // todo return to create user form
      } else {
        const pwflash =
          rnd_password && !send_pwreset_email
            ? req.__(` with password %s`, code(password))
            : "";

        req.flash(
          pwflash ? "warning" : "success",
          req.__(`User %s created`, email) + pwflash
        );

        if (rnd_password && send_pwreset_email)
          await send_reset_email(u, req, { creating: true });
      }
    }
    res.redirect(`/useradmin`);
  })
);

/**
 * Reset password for user
 * @name post/reset-password/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/reset-password/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await send_reset_email(u, req, { from_admin: true });
    req.flash("success", req.__(`Reset password link sent to %s`, u.email));

    res.redirect(`/useradmin`);
  })
);

/**
 * Send verification email for user
 * @name post/send-verification/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/send-verification/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    // todo add test case
    const result = await send_verification_email(u, req);
    if (result.error)
      req.flash(
        "danger",
        req.__(`Verification email sender error:`, result.error)
      );
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
 * @name post/gen-api-token/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/gen-api-token/:id",
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
 * @name post/remove-api-token/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/remove-api-token/:id",
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
 * @name post/set-random-password/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/set-random-password/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    const newpw = User.generate_password();
    await u.changePasswordTo(newpw);
    await u.destroy_sessions();
    req.flash(
      "warning",
      req.__(`Changed password for user %s to %s`, u.email, newpw)
    );

    res.redirect(`/useradmin`);
  })
);

/**
 * Become user
 * @name post/become-user/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/become-user/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findForSession({ id });
    if (u) {
      await u.relogin(req);
      req.flash(
        "success",
        req.__(
          `Your are now logged in as %s. Logout and login again to assume your usual identity`,
          u.email
        )
      );
      res.redirect(`/`);
    } else {
      req.flash("error", req.__(`User not found`));
      res.redirect(`/useradmin`);
    }
  })
);

/**
 * @name post/disable/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/disable/:id",
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

/**
 * @name post/force-logout/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/force-logout/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await u.destroy_sessions();
    req.flash("success", req.__(`Logged out user %s`, u.email));
    res.redirect(`/useradmin`);
  })
);

/**
 * @name post/enable/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/enable/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await u.update({ disabled: false });
    req.flash("success", req.__(`Enabled user %s`, u.email));
    res.redirect(`/useradmin`);
  })
);

/**
 * @name post/delete/:id
 * @function
 * @memberof module:auth/admin~auth/adminRouter
 */
router.post(
  "/delete/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    await u.delete();
    req.flash("success", req.__(`User %s deleted`, u.email));

    res.redirect(`/useradmin`);
  })
);
