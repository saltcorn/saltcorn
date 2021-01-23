const Router = require("express-promise-router");
const { contract, is } = require("contractis");

const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Role = require("@saltcorn/data/models/role");
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
const {
  isAdmin,
  setTenant,
  error_catcher,
  csrfField,
} = require("../routes/utils");
const { send_reset_email } = require("./resetpw");
const { getState } = require("@saltcorn/data/db/state");
const {
  a,
  div,
  button,
  text,
  span,
  code,
  form,
  option,
  select,
  br,
  h4,
  h5,
  p,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const {
  send_users_page,
  config_fields_form,
  save_config_from_form,
} = require("../markup/admin");
const router = new Router();
module.exports = router;
const editRoleLayoutForm = (role, layouts, layout_by_role, req) =>
  form(
    {
      action: `/roleadmin/setrolelayout/${role.id}`,
      method: "post",
    },
    csrfField(req),
    select(
      { name: "layout", onchange: "form.submit()" },
      layouts.map((layout, ix) =>
        option(
          {
            value: layout,
            ...((layout_by_role[role.id]
              ? layout_by_role[role.id] === layout
              : ix == layouts.length - 1) && { selected: true }),
          },
          text(layout)
        )
      )
    )
  );

const roleForm = () =>
  new Form({
    action: "/roleadmin/edit",
    fields: [
      {
        name: "id",
        type: "Integer",
        label: "ID",
        sublabel: "This is the rank...",
        attributes: { max: 10, min: 1 },
      },
      { name: "role", label: "Role name", type: "String" },
    ],
  });

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const roles = await User.get_roles();
    var roleMap = {};
    roles.forEach((r) => {
      roleMap[r.id] = r.role;
    });
    const layouts = Object.keys(getState().layouts).filter(
      (l) => l !== "emergency"
    );
    const layout_by_role = getState().getConfig("layout_by_role");
    send_users_page({
      res,
      req,
      active_sub: "Roles",
      contents: {
        type: "card",
        title: req.__("Roles"),
        contents: [
          mkTable(
            [
              { label: req.__("ID"), key: "id" },
              { label: req.__("Role"), key: "role" },
              {
                label: req.__("Theme"),
                key: (role) =>
                  editRoleLayoutForm(role, layouts, layout_by_role, req),
              },
            ],
            roles
          ),
          link("/roleadmin/new", req.__("Add new role")),
        ],
      },
    });
  })
);

router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await roleForm(req);

    send_users_page({
      res,
      req,
      active_sub: "Roles",
      sub2_page: "New",
      contents: {
        type: "card",
        title: req.__("Roles"),
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);
router.post(
  "/edit",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await roleForm(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_users_page({
        res,
        req,
        active_sub: "Roles",
        sub2_page: "New",
        contents: {
          type: "card",
          title: req.__("Roles"),
          contents: [renderForm(form, req.csrfToken())],
        },
      });
    } else {
      const r = new Role(form.values);
      const ex = await Role.findOne({ id: r.id });
      if (ex) {
        await ex.update(r);
      } else {
        await Role.create(r);
      }
      req.flash("success", req.__(`Role updated`));
      res.redirect(`/roleadmin`);
    }
  })
);

router.post(
  "/setrolelayout/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const layout_by_role = getState().getConfig("layout_by_role");
    layout_by_role[+id] = req.body.layout;
    await getState().setConfig("layout_by_role", layout_by_role);
    req.flash("success", req.__(`Saved layout for role`));

    res.redirect(`/roleadmin/`);
  })
);
