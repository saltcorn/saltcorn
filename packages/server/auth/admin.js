const Router = require("express-promise-router");
const { contract, is } = require("contractis");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
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
const {
  a,
  div,
  button,
  text,
  span,
  code,
  br,
} = require("@saltcorn/markup/tags");
const router = new Router();
module.exports = router;

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
    const form = new Form({
      fields: [
        new Field({
          label: req.__("E-mail"),
          name: "email",
          input_type: "text",
        }),
        roleField,
      ],
      action: "/useradmin/save",
      submitLabel: user ? req.__("Save") : req.__("Create"),
    });
    if (!user) {
      form.fields.push(
        new Field({
          label: req.__("Set random password"),
          name: "rnd_password",
          class: "rnd_password",
          type: "Bool",
          default: true,
        })
      );
      form.fields.push(
        new Field({
          label: req.__("Password"),
          name: "password",
          input_type: "password",
          showIf: { ".rnd_password": false },
        })
      );
      can_reset &&
        form.fields.push(
          new Field({
            label: req.__("Send password reset email"),
            name: "send_pwreset_email",
            type: "Bool",
            default: true,
            showIf: { ".rnd_password": true },
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

const wrap = (req, cardTitle, response, lastBc) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: req.__("Settings") },
        { text: req.__("Users"), href: lastBc && "/useradmin" },
        ...(lastBc ? [lastBc] : []),
      ],
    },
    {
      type: "card",
      title: cardTitle,
      contents: response,
    },
  ],
});
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
    const users = await User.find();
    const roles = await User.get_roles();
    var roleMap = {};
    roles.forEach((r) => {
      roleMap[r.id] = r.role;
    });
    const can_reset = getState().getConfig("smtp_host", "") !== "";
    res.sendWrap(
      req.__("Users"),
      wrap(req, req.__("Users"), [
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
            { label: req.__("Role"), key: (r) => roleMap[r.role_id] },
            {
              label: "",
              key: (r) => user_dropdown(r, req, can_reset),
            },
          ],
          users
        ),
        link(`/useradmin/new`, req.__("Add user")),
      ])
    );
  })
);

router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await userForm(req);
    res.sendWrap(
      req.__("New user"),
      wrap(req, req.__("New user"), renderForm(form, req.csrfToken()), {
        text: req.__("New"),
      })
    );
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

    res.sendWrap(req.__("Edit user"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Settings") },
            { text: req.__("Users"), href: "/useradmin" },
            { text: user.email },
          ],
        },
        {
          type: "card",
          title: req.__("Edit user %s", user.email),
          contents: renderForm(form, req.csrfToken()),
        },
        {
          type: "card",
          title: req.__("API token"),
          contents: [
            div(
              user.api_token
                ? span({ class: "mr-1" }, "API token for this user: ") +
                    code(user.api_token)
                : req.__("No API token issued")
            ),
            div(
              { class: "mt-4" },
              post_btn(
                `/useradmin/gen-api-token/${user.id}`,
                user.api_token ? "Reset" : "Generate",
                req.csrfToken()
              )
            ),
          ],
        },
      ],
    });
  })
);

router.post(
  "/save",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    let {
      email,
      password,
      role_id,
      id,
      rnd_password,
      send_pwreset_email,
    } = req.body;
    if (id) {
      try {
        await db.update("users", { email, role_id }, id);
        req.flash("success", req.__(`User %s saved`, email));
      } catch (e) {
        req.flash("error", req.__(`Error editing user: %s`, e.message));
      }
    } else {
      if (rnd_password) password = generate_password();
      const u = await User.create({ email, password, role_id: +role_id });
      const pwflash =
        rnd_password && !send_pwreset_email
          ? req.__(` with password %s`, code(password))
          : "";
      if (u.error) req.flash("error", u.error);
      else req.flash("success", req.__(`User %s created`, email) + pwflash);
      if (rnd_password && send_pwreset_email) await send_reset_email(u, req);
    }
    res.redirect(`/useradmin`);
  })
);

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
const generate_password = () => {
  const candidate = is.str.generate().split(" ").join("");
  if (candidate.length < 10) return generate_password();
  else return candidate;
};

router.post(
  "/set-random-password/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await User.findOne({ id });
    const newpw = generate_password();
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
    await u.destroy_sessions();
    await u.delete();
    req.flash("success", req.__(`User %s deleted`, u.email));

    res.redirect(`/useradmin`);
  })
);
