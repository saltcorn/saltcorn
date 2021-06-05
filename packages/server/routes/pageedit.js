const Router = require("express-promise-router");

const View = require("@saltcorn/data/models/view");
const Field = require("@saltcorn/data/models/field");
const Page = require("@saltcorn/data/models/page");
const { div, a } = require("@saltcorn/markup/tags");
const { getState } = require("@saltcorn/data/db/state");
const User = require("@saltcorn/data/models/user");
const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const File = require("@saltcorn/data/models/file");
const Trigger = require("@saltcorn/data/models/trigger");
const { getViews } = require("@saltcorn/data/models/layout");
const { add_to_menu } = require("@saltcorn/data/models/pack");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn,
  post_dropdown_item,
  renderBuilder,
  settingsDropdown,
} = require("@saltcorn/markup");
const { getActionConfigFields } = require("@saltcorn/data/plugin-helper");
const { editRoleForm, wizardCardTitle } = require("../markup/forms.js");

const router = new Router();
module.exports = router;

const editPageRoleForm = (page, roles, req) =>
  editRoleForm({
    url: `/pageedit/setrole/${page.id}`,
    current_role: page.min_role,
    roles,
    req,
  });

const page_dropdown = (page, req) =>
  settingsDropdown(`dropdownMenuButton${page.id}`, [
    a(
      {
        class: "dropdown-item",
        href: `/page/${encodeURIComponent(page.name)}`,
      },
      '<i class="fas fa-running"></i>&nbsp;' + req.__("Run")
    ),
    a(
      {
        class: "dropdown-item",
        href: `/pageedit/edit/${encodeURIComponent(page.name)}`,
      },
      '<i class="fas fa-edit"></i>&nbsp;' + req.__("Edit")
    ),
    post_dropdown_item(
      `/pageedit/add-to-menu/${page.id}`,
      '<i class="fas fa-bars"></i>&nbsp;' + req.__("Add to menu"),
      req
    ),
    post_dropdown_item(
      `/pageedit/clone/${page.id}`,
      '<i class="far fa-copy"></i>&nbsp;' + req.__("Duplicate"),
      req
    ),
    div({ class: "dropdown-divider" }),
    post_dropdown_item(
      `/pageedit/delete/${page.id}`,
      '<i class="far fa-trash-alt"></i>&nbsp;' + req.__("Delete"),
      req,
      true,
      page.name
    ),
  ]);
const pageFlow = (req) =>
  new Workflow({
    action: "/pageedit/edit/",
    onDone: async (context) => {
      const { id, columns, ...pageRow } = context;
      pageRow.min_role = +pageRow.min_role;
      if (!pageRow.fixed_states) pageRow.fixed_states = {};
      if (id) {
        await Page.update(id, pageRow);
      } else await Page.create(pageRow);
      return {
        redirect: `/pageedit`,
        flash: ["success", req.__(`Page %s saved`, pageRow.name)],
      };
    },
    steps: [
      {
        name: req.__("Identity"),
        form: async (context) => {
          const roles = await User.get_roles();

          return new Form({
            fields: [
              new Field({
                label: req.__("Name"),
                name: "name",
                required: true,
                validator(s) {
                  if (s.length < 1) return req.__("Missing name");
                },
                sublabel: req.__("A short name that will be in your URL"),
                type: "String",
              }),
              new Field({
                label: req.__("Title"),
                name: "title",
                sublabel: req.__("Page title"),
                input_type: "text",
              }),
              new Field({
                label: req.__("Description"),
                name: "description",
                sublabel: req.__("A longer description"),
                input_type: "text",
              }),
              {
                name: "min_role",
                label: req.__("Minimum role"),
                sublabel: req.__("Role required to access page"),
                input_type: "select",
                options: roles.map((r) => ({ value: r.id, label: r.role })),
              },
            ],
          });
        },
      },
      {
        name: req.__("Layout"),
        builder: async (context) => {
          const views = await View.find();
          const pages = await Page.find();
          const images = await File.find({ mime_super: "image" });
          const roles = await User.get_roles();
          const stateActions = getState().actions;
          const actions = Object.entries(stateActions)
            .filter(([k, v]) => !v.requireRow)
            .map(([k, v]) => k);
          const triggers = await Trigger.find({
            when_trigger: { or: ["API call", "Never"] },
          });
          triggers.forEach((tr) => {
            actions.push(tr.name);
          });
          const actionConfigForms = {};
          for (const name of actions) {
            const action = stateActions[name];
            if (action && action.configFields) {
              actionConfigForms[name] = await getActionConfigFields(action);
            }
          }
          return {
            views,
            images,
            pages,
            actions,
            actionConfigForms,
            page_name: context.name,
            page_id: context.id,
            mode: "page",
            roles,
          };
        },
      },
      {
        name: req.__("Fixed states"),
        contextField: "fixed_states",
        onlyWhen: async (context) => {
          const p = new Page(context);
          const vs = await getViews(p.layout);
          return vs.filter((v) => v.state === "fixed").length > 0;
        },
        form: async (context) => {
          const p = new Page(context);
          const vs = await getViews(p.layout);
          const fixedvs = vs.filter((vseg) => vseg.state === "fixed");
          const fields = [];
          for (const vseg of fixedvs) {
            const v = await View.findOne({ name: vseg.view });
            if (v) {
              const fs = await v.get_state_fields();
              if (fs.length > 0)
                fields.push({
                  label: req.__(`Fixed state for %s view`, v.name),
                  input_type: "section_header",
                });
              for (const frec of fs) {
                const f = new Field(frec);
                f.required = false;
                if (f.type && f.type.name === "Bool") f.fieldview = "tristate";
                f.parent_field = vseg.name;

                await f.fill_fkey_options(true);
                fields.push(f);
              }
            }
          }
          return new Form({
            blurb: req.__("Set fixed states for views"),
            fields,
          });
        },
      },
    ],
  });

const getPageList = (rows, roles, req) => {
  return div(
    mkTable(
      [
        {
          label: req.__("Name"),
          key: (r) => link(`/page/${r.name}`, r.name),
        },
        {
          label: req.__("Role to access"),
          key: (row) => editPageRoleForm(row, roles, req),
        },
        {
          label: req.__("Edit"),
          key: (r) => link(`/pageedit/edit/${r.name}`, req.__("Edit")),
        },
        {
          label: "",
          key: (r) => page_dropdown(r, req),
        },
      ],
      rows,
      { hover: true }
    ),
    a(
      {
        href: `/pageedit/new`,
        class: "btn btn-primary",
      },
      req.__("Create page")
    )
  );
};
/**
 * Root pages configuration Form
 * Allows to configure root page for each role
 * @param pages - list of pages
 * @param roles - list of roles
 * @param req - request
 * @returns {Form} return Form
 */
const getRootPageForm = (pages, roles, req) => {
  const form = new Form({
    action: "/pageedit/set_root_page",
    submitLabel: req.__("Save"),
    submitButtonClass: "btn-outline-primary",
    onChange: "remove_outline(this)",
    blurb: req.__(
      "The root page is the page that is served when the user visits the home location (/). This can be set for each user role."
    ),
    fields: roles.map(
      (r) =>
        new Field({
          name: r.role,
          label: r.role,
          input_type: "select",
          options: ["", ...pages.map((p) => p.name)],
        })
    ),
  });
  const modernCfg = getState().getConfig("home_page_by_role", false);
  for (const role of roles) {
    form.values[role.role] = modernCfg && modernCfg[role.id];
    if (typeof form.values[role.role] !== "string")
      form.values[role.role] = getState().getConfig(role.role + "_home", "");
  }
  return form;
};
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const pages = await Page.find({}, { orderBy: "name" });
    const roles = await User.get_roles();

    res.sendWrap(req.__("Pages"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Pages") }],
        },
        {
          type: "card",
          title: req.__("Your pages"),
          contents: getPageList(pages, roles, req),
        },
        {
          type: "card",
          title: req.__("Root pages"),
          contents: renderForm(
            getRootPageForm(pages, roles, req),
            req.csrfToken()
          ),
        },
      ],
    });
  })
);

const respondWorkflow = (page, wf, wfres, req, res) => {
  const wrap = (contents, noCard) => ({
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Pages"), href: "/pageedit" },
          page
            ? { href: `/pageedit/edit/${page.name}`, text: page.name }
            : { text: req.__("New") },
          { workflow: wf, step: wfres },
        ],
      },
      {
        type: noCard ? "container" : "card",
        title: wizardCardTitle(page ? page.name : req.__("New"), wf, wfres),
        contents,
      },
    ],
  });
  if (wfres.flash) req.flash(wfres.flash[0], wfres.flash[1]);
  if (wfres.renderForm)
    res.sendWrap(
      req.__(`Page attributes`),
      wrap(renderForm(wfres.renderForm, req.csrfToken()))
    );
  else if (wfres.renderBuilder)
    res.sendWrap(
      req.__(`Page configuration`),
      wrap(renderBuilder(wfres.renderBuilder, req.csrfToken()), true)
    );
  else res.redirect(wfres.redirect);
};

router.get(
  "/edit/:pagename",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    const page = await Page.findOne({ name: pagename });
    if (!page) {
      req.flash("error", req.__(`Page %s not found`, pagename));
      res.redirect(`/pageedit`);
    } else {
      const wf = pageFlow(req);
      const wfres = await wf.run(page, req);
      respondWorkflow(page, wf, wfres, req, res);
    }
  })
);

router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wf = pageFlow(req);
    const wfres = await wf.run({}, req);
    respondWorkflow(null, wf, wfres, req, res);
  })
);

router.post(
  "/edit",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wf = pageFlow(req);
    const wfres = await wf.run(req.body, req);
    const page =
      wfres.context && (await Page.findOne({ name: wfres.context.name }));

    respondWorkflow(page, wf, wfres, req, res);
  })
);

router.post(
  "/savebuilder/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;

    if (id && req.body.layout) {
      await Page.update(+id, { layout: req.body.layout });
      res.json({ success: "ok" });
    } else {
      res.json({ error: "no page or no layout." });
    }
  })
);

router.post(
  "/delete/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const page = await Page.findOne({ id });
    await page.delete();
    req.flash("success", req.__(`Page deleted`));
    res.redirect(`/pageedit`);
  })
);

router.post(
  "/set_root_page",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const pages = await Page.find({}, { orderBy: "name" });
    const roles = await User.get_roles();
    const form = await getRootPageForm(pages, roles, req);
    const valres = form.validate(req.body);
    if (valres.success) {
      const home_page_by_role =
        getState().getConfigCopy("home_page_by_role", []) || [];
      for (const role of roles) {
        home_page_by_role[role.id] = valres.success[role.role];
      }
      await getState().setConfig("home_page_by_role", home_page_by_role);
      req.flash("success", req.__(`Root pages updated`));
    } else req.flash("danger", req.__(`Error reading pages`));
    res.redirect(`/pageedit`);
  })
);

router.post(
  "/add-to-menu/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const page = await Page.findOne({ id });
    await add_to_menu({
      label: page.name,
      type: "Page",
      min_role: page.min_role,
      pagename: page.name,
    });
    req.flash(
      "success",
      req.__(
        "Page %s added to menu. Adjust access permissions in Settings &raquo; Menu",
        page.name
      )
    );
    res.redirect(`/pageedit`);
  })
);
router.post(
  "/clone/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const page = await Page.findOne({ id });
    const newpage = await page.clone();
    req.flash(
      "success",
      req.__("Page %s duplicated as %s", page.name, newpage.name)
    );
    res.redirect(`/pageedit`);
  })
);
router.post(
  "/setrole/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const role = req.body.role;
    await Page.update(+id, { min_role: role });
    const page = await Page.findOne({ id });
    const roles = await User.get_roles();
    const roleRow = roles.find((r) => r.id === +role);
    if (roleRow && page)
      req.flash(
        "success",
        req.__(`Minimum role for %s updated to %s`, page.name, roleRow.role)
      );
    else req.flash("success", req.__(`Minimum role updated`));

    res.redirect("/pageedit");
  })
);
