/**
 * @category server
 * @module auth/roleadmin
 * @subcategory auth
 */
const Router = require("express-promise-router");

//const db = require("@saltcorn/data/db");
const User = require("@saltcorn/data/models/user");
const Role = require("@saltcorn/data/models/role");
const Form = require("@saltcorn/data/models/form");
const {
  mkTable,
  renderForm,
  link,
  post_delete_btn,
} = require("@saltcorn/markup");
const { isAdmin, error_catcher, csrfField } = require("../routes/utils");
const { getState } = require("@saltcorn/data/db/state");
const { text, form, option, select, a, i } = require("@saltcorn/markup/tags");
const { send_users_page } = require("../markup/admin");

/**
 * @type {object}
 * @const
 * @namespace roleadminRouter
 * @category server
 * @subcategory auth
 */
const router = new Router();
module.exports = router;

/**
 * @param {Role} role
 * @param {Layout[]} layouts
 * @param {*} layout_by_role
 * @param {object} req
 * @returns {Form}
 */
const editRoleLayoutForm = (role, layouts, layout_by_role, req) => {
  //console.log(layouts);
  let edit_link = "";
  const current_layout = layout_by_role[role.id] || layouts[layouts.length - 1];
  let plugin = getState().plugins[current_layout];

  if (plugin?.configuration_workflow)
    edit_link = a(
      { href: `/plugins/configure/${encodeURIComponent(current_layout)}` },
      i({ class: "fa fa-cog ms-2" })
    );

  return form(
    {
      action: `/roleadmin/setrolelayout/${role.id}`,
      method: "post",
    },
    csrfField(req),
    select(
      {
        name: "layout",
        onchange: "form.submit()",
        class: "form-select form-select-sm w-unset d-inline",
      },
      layouts.map((layout, ix) =>
        option(
          {
            value: layout,
            ...((layout_by_role[role.id]
              ? layout_by_role[role.id] === layout
              : ix === layouts.length - 1) && { selected: true }),
          },
          text(layout)
        )
      )
    ),
    edit_link
  );
};

/**
 *
 * @param {Role} role
 * @param twofa_policy_by_role
 * @param {object} req
 * @returns {Form}
 */
const editRole2FAPolicyForm = (role, twofa_policy_by_role, req) =>
  form(
    {
      action: `/roleadmin/setrole2fapolicy/${role.id}`,
      method: "post",
    },
    csrfField(req),
    select(
      {
        name: "policy",
        onchange: "form.submit()",
        class: "form-select form-select-sm w-unset d-inline",
      },
      ["Optional", "Disabled", "Mandatory"].map((p) =>
        option({ selected: twofa_policy_by_role[role.id] === p }, p)
      )
    )
  );

/**
 * @param {object} req
 * @returns {Form}
 */
const roleForm = (req) =>
  new Form({
    action: "/roleadmin/edit",
    validator: (vs) => {
      if (vs.id > 1 && vs.id < 11) return req.__("Role IDs 2-10 are reserved");
    },
    fields: [
      {
        name: "id",
        type: "Integer",
        label: req.__("ID"),
        sublabel: req.__(
          "This is the rank of the user role, lower role IDs will be able to access more resources."
        ),
        default: 70,
        attributes: { max: 100, min: 1 },
      },
      { name: "role", label: req.__("Role name"), type: "String" },
    ],
  });

/**
 * @name get
 * @function
 * @memberof module:auth/roleadmin~roleadminRouter
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const roles = await User.get_roles();
    let roleMap = {};
    roles.forEach((r) => {
      roleMap[r.id] = r.role;
    });
    const layouts = Object.keys(getState().layouts).filter(
      (l) => l !== "emergency"
    );
    const layout_by_role = getState().getConfig("layout_by_role");
    const twofa_policy_by_role = getState().getConfig("twofa_policy_by_role");
    send_users_page({
      res,
      req,
      active_sub: "Roles",
      contents: {
        type: "card",
        title:
          req.__("Roles") +
          `<a href="javascript:ajax_modal('/admin/help/User%20roles?')"><i class="fas fa-question-circle ms-1"></i></a>`,
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
              {
                label: req.__("2FA policy"),
                key: (role) =>
                  role.id === 100
                    ? ""
                    : editRole2FAPolicyForm(role, twofa_policy_by_role, req),
              },
              {
                label: req.__("Delete"),
                key: (r) =>
                  unDeletableRoles.includes(r.id)
                    ? ""
                    : post_delete_btn(`/roleadmin/delete/${r.id}`, req),
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

/**
 * @name get/new
 * @function
 * @memberof module:auth/roleadmin~roleadminRouter
 */
router.get(
  "/new",
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
        title:
          req.__("Roles") +
          `<a href="javascript:ajax_modal('/admin/help/User%20roles?')"><i class="fas fa-question-circle ms-1"></i></a>`,
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);

/**
 * @name post/edit
 * @function
 * @memberof module:auth/roleadmin~roleadminRouter
 */
router.post(
  "/edit",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await roleForm(req);
    form.validate(req.body || {});
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

/**
 * @name post/setrolelayout/:id
 * @function
 * @memberof module:auth/roleadmin~roleadminRouter
 */
router.post(
  "/setrolelayout/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const layout_by_role = getState().getConfigCopy("layout_by_role");
    layout_by_role[+id] = (req.body || {}).layout;
    await getState().setConfig("layout_by_role", layout_by_role);
    req.flash("success", req.__(`Saved layout for role`));

    res.redirect(`/roleadmin`);
  })
);

/**
 * @name post/setrolelayout/:id
 * @function
 * @memberof module:auth/roleadmin~roleadminRouter
 */
router.post(
  "/setrole2fapolicy/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const twofa_policy_by_role = getState().getConfigCopy(
      "twofa_policy_by_role"
    );
    twofa_policy_by_role[+id] = (req.body || {}).policy;
    await getState().setConfig("twofa_policy_by_role", twofa_policy_by_role);
    req.flash("success", req.__(`Saved 2FA policy for role`));

    res.redirect(`/roleadmin`);
  })
);
const unDeletableRoles = [1, 80, 100];
/**
 * @name post/delete/:id
 * @function
 * @memberof module:auth/roleadmin~roleadminRouter
 */
router.post(
  "/delete/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const u = await Role.findOne({ id });
    const nuser = await User.count({ role_id: id });
    if (unDeletableRoles.includes(+id))
      req.flash("warning", req.__(`Cannot delete this role`));
    else if (nuser > 0) {
      req.flash("warning", req.__(`First delete users with this role`));
    } else {
      try {
        await u.delete();
        req.flash("success", req.__(`Role %s deleted`, u.role));
      } catch (e) {
        console.error(e);
        req.flash("error", e.message);
      }
    }
    res.redirect(`/roleadmin`);
  })
);
