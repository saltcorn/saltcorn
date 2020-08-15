const Router = require("express-promise-router");
const { contract, is } = require("contractis");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const { isAdmin, setTenant, error_catcher } = require("../routes/utils");

const router = new Router();
module.exports = router;

const userForm = contract(
  is.fun(is.maybe(is.class("User")), is.promise(is.class("Form"))),
  async user => {
    const roleField = new Field({
      label: "Role",
      name: "role_id",
      type: "Key",
      reftable_name: "roles"
    });
    const roles = await User.get_roles();
    roleField.options = roles.map(r => ({ label: r.role, value: r.id }));

    const form = new Form({
      fields: [
        new Field({ label: "E-mail", name: "email", input_type: "text" })
      ],
      action: "/useradmin/save",
      submitLabel: user ? "Save" : "Create"
    });
    if (!user)
      form.fields.push(
        new Field({
          label: "Password",
          name: "password",
          input_type: "password"
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
const wrap = (cardTitle, response, lastBc) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: "Settings" },
        { text: "Users", href: lastBc && "/useradmin" },
        ...(lastBc ? [lastBc] : [])
      ]
    },
    {
      type: "card",
      title: cardTitle,
      contents: response
    }
  ]
});
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const users = await User.find();
    const roles = await User.get_roles();
    var roleMap = {};
    roles.forEach(r => {
      roleMap[r.id] = r.role;
    });
    res.sendWrap(
      "Users",
      wrap("Users", [
        mkTable(
          [
            { label: "ID", key: "id" },
            { label: "Email", key: "email" },
            { label: "Role", key: r => roleMap[r.role_id] },
            { label: "View", key: r => link(`/useradmin/${r.id}`, "Edit") },
            {
              label: "Delete",
              key: r =>
                r.id !== req.user.id
                  ? post_btn(
                      `/useradmin/delete/${r.id}`,
                      "Delete",
                      req.csrfToken()
                    )
                  : ""
            }
          ],
          users
        ),
        link(`/useradmin/new`, "Add user")
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
      "New user",
      wrap("New user", renderForm(form, req.csrfToken()), { text: "New" })
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
      "Edit user",
      wrap(`Edit user ${user.email}`, renderForm(form, req.csrfToken()), {
        text: user.email
      })
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
      await db.update("users", { email, role_id }, id);

      req.flash("success", `User ${email} saved`);
    } else {
      const u = await User.create({ email, password, role_id: +role_id });

      req.flash("success", `User ${email} created`);
    }
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
    req.flash("success", `User ${u.email} deleted`);

    res.redirect(`/useradmin`);
  })
);
