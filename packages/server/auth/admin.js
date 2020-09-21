const Router = require("express-promise-router");
const { contract, is } = require("contractis");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { isAdmin, setTenant, error_catcher } = require("../routes/utils");
const { send_reset_email } = require("./resetpw");
const { getState } = require("@saltcorn/data/db/state");

const router = new Router();
module.exports = router;

const userForm = contract(
  is.fun(is.maybe(is.class("User")), is.promise(is.class("Form"))),
  async (user) => {
    const roleField = new Field({
      label: "Role",
      name: "role_id",
      type: "Key",
      reftable_name: "roles",
    });
    const roles = await User.get_roles();
    roleField.options = roles.map((r) => ({ label: r.role, value: r.id }));

    const form = new Form({
      fields: [
        new Field({ label: "E-mail", name: "email", input_type: "text" }),
      ],
      action: "/useradmin/save",
      submitLabel: user ? "Save" : "Create",
    });
    if (!user)
      form.fields.push(
        new Field({
          label: "Password",
          name: "password",
          input_type: "password",
        })
      );
    form.fields.push(roleField);
    if (user) {
      form.hidden("id");
      form.values = user;
      delete form.values.password;
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
            { label: req.__("Email"), key: "email" },
            { label: req.__("Role"), key: (r) => roleMap[r.role_id] },
            {
              label: req.__("View"),
              key: (r) => link(`/useradmin/${r.id}`, "Edit"),
            },
            ...(can_reset
              ? [
                  {
                    label: req.__("Reset password"),
                    key: (r) =>
                      post_btn(
                        `/useradmin/reset-password/${r.id}`,
                        req.__("Send"),
                        req.csrfToken(),
                        { small: true }
                      ),
                  },
                ]
              : []),
            {
              label: req.__("Delete"),
              key: (r) =>
                r.id !== req.user.id
                  ? post_btn(
                      `/useradmin/delete/${r.id}`,
                      req.__("Delete"),
                      req.csrfToken(),
                      { small: true }
                    )
                  : "",
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
    const form = await userForm();
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
    const form = await userForm(user);

    res.sendWrap(
      req.__("Edit user"),
      wrap(
        req,
        req.__("Edit user %s", user.email),
        renderForm(form, req.csrfToken()),
        {
          text: user.email,
        }
      )
    );
  })
);

router.post(
  "/save",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { email, password, role_id, id } = req.body;
    if (id) {
      try {
        await db.update("users", { email, role_id }, id);
        req.flash("success", req.__(`User %s saved`, email));
      } catch (e) {
        req.flash("error", req.__(`Error editing user: %s`, e.message));
      }
    } else {
      const u = await User.create({ email, password, role_id: +role_id });
      if (u.error) req.flash("error", u.error);
      else req.flash("success", req.__(`User %s created`, email));
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
