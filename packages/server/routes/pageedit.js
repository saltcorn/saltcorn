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
const { getViews } = require("@saltcorn/data/models/layout");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn,
  renderBuilder,
} = require("@saltcorn/markup");
const router = new Router();
module.exports = router;

const pageFlow = new Workflow({
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
      flash: ["success", `Page ${pageRow.name} saved`],
    };
  },
  steps: [
    {
      name: "Page",
      form: async (context) => {
        const roles = await User.get_roles();

        return new Form({
          fields: [
            new Field({
              label: "Name",
              name: "name",
              sublabel: "A short name that will be in your URL",
              input_type: "text",
            }),
            new Field({
              label: "Title",
              name: "title",
              sublabel: "Page title",
              input_type: "text",
            }),
            new Field({
              label: "Description",
              name: "description",
              sublabel: "A longer description",
              input_type: "text",
            }),
            {
              name: "min_role",
              label: "Role required to access page",
              input_type: "select",
              options: roles.map((r) => ({ value: r.id, label: r.role })),
            },
          ],
        });
      },
    },
    {
      name: "Layout",
      builder: async (context) => {
        const views = await View.find();
        const images = await File.find({ mime_super: "image" });

        return {
          views,
          images,
          page_name: context.name,
          page_id: context.id,
          mode: "page",
        };
      },
    },
    {
      name: "Fixed states",
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
          const fs = await v.get_state_fields();
          if (fs.length > 0)
            fields.push({
              label: `Fixed state for ${v.name} view`,
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
        return new Form({
          blurb: "Set fixed states for views",
          fields,
        });
      },
    },
  ],
});

const getPageList = (rows, roles, csrfToken) => {
  return div(
    mkTable(
      [
        { label: "Name", key: "name" },
        {
          label: "Role to access",
          key: (row) => {
            const role = roles.find((r) => r.id === row.min_role);
            return role ? role.role : "?";
          },
        },

        {
          label: "Run",
          key: (r) => link(`/page/${r.name}`, "Run"),
        },
        {
          label: "Edit",
          key: (r) => link(`/pageedit/edit/${r.name}`, "Edit"),
        },
        {
          label: "Delete",
          key: (r) => post_delete_btn(`/pageedit/delete/${r.id}`, csrfToken),
        },
      ],
      rows
    ),
    a(
      {
        href: `/pageedit/new`,
        class: "btn btn-primary",
      },
      "Add page"
    )
  );
};

const getRootPageForm = (pages, roles) => {
  const form = new Form({
    action: "/pageedit/set_root_page",
    blurb:
      "The root page is the page that is served when the user visits the home location (/). This can be set for each user role.",
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
  for (const role of roles) {
    form.values[role.role] = getState().getConfig(role.role + "_home", "");
  }
  return form;
};
router.get("/", setTenant, isAdmin, async (req, res) => {
  const pages = await Page.find({}, { orderBy: "name" });
  const roles = await User.get_roles();

  res.sendWrap("Pages", {
    above: [
      {
        type: "breadcrumbs",
        crumbs: [{ text: "Pages" }],
      },
      {
        type: "card",
        title: "Your pages",
        contents: getPageList(pages, roles, req.csrfToken()),
      },
      {
        type: "card",
        title: "Root pages",
        contents: renderForm(getRootPageForm(pages, roles), req.csrfToken()),
      },
    ],
  });
});

const respondWorkflow = (page, wfres, req, res) => {
  const wrap = (contents, noCard) => ({
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: "Pages", href: "/pageedit" },
          page
            ? { href: `/pageedit/edit/${page.name}`, text: page.name }
            : { text: "New" },
          { text: wfres.stepName },
        ],
      },
      {
        type: noCard ? "container" : "card",
        title: `${wfres.stepName} (step ${wfres.currentStep} / max ${wfres.maxSteps})`,
        contents,
      },
    ],
  });
  if (wfres.renderForm)
    res.sendWrap(
      `Page attributes`,
      wrap(renderForm(wfres.renderForm, req.csrfToken()))
    );
  else if (wfres.renderBuilder)
    res.sendWrap(
      `Page configuration`,
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
    const wfres = await pageFlow.run(page);
    respondWorkflow(page, wfres, req, res);
  })
);

router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wfres = await pageFlow.run({});
    respondWorkflow(null, wfres, req, res);
  })
);

router.post(
  "/edit",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wfres = await pageFlow.run(req.body);
    const page =
      wfres.context && (await Page.findOne({ name: wfres.context.name }));

    respondWorkflow(page, wfres, req, res);
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
    req.flash("success", `Page deleted`);
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
    const form = await getRootPageForm(pages, roles);
    const valres = form.validate(req.body);
    if (valres.success) {
      for (const role of roles) {
        await getState().setConfig(
          role.role + "_home",
          valres.success[role.role]
        );
      }
      req.flash("success", `Root pages updated`);
    } else req.flash("danger", `Error reading pages`);
    res.redirect(`/pageedit`);
  })
);
