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
        name: req.__("Page"),
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
          key: (row) => {
            const role = roles.find((r) => r.id === row.min_role);
            return role ? role.role : "?";
          },
        },
        {
          label: req.__("Edit"),
          key: (r) => link(`/pageedit/edit/${r.name}`, req.__("Edit")),
        },
        {
          label: req.__("Delete"),
          key: (r) => post_delete_btn(`/pageedit/delete/${r.id}`, req, r.name),
        },
      ],
      rows
    ),
    a(
      {
        href: `/pageedit/new`,
        class: "btn btn-primary",
      },
      req.__("Add page")
    )
  );
};

const getRootPageForm = (pages, roles, req) => {
  const form = new Form({
    action: "/pageedit/set_root_page",
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
  for (const role of roles) {
    form.values[role.role] = getState().getConfig(role.role + "_home", "");
  }
  return form;
};
router.get("/", setTenant, isAdmin, async (req, res) => {
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
});

const respondWorkflow = (page, wfres, req, res) => {
  const wrap = (contents, noCard) => ({
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Pages"), href: "/pageedit" },
          page
            ? { href: `/pageedit/edit/${page.name}`, text: page.name }
            : { text: req.__("New") },
          { text: wfres.stepName },
        ],
      },
      {
        type: noCard ? "container" : "card",
        title: wfres.title,
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
      const wfres = await pageFlow(req).run(page, req);
      respondWorkflow(page, wfres, req, res);
    }
  })
);

router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wfres = await pageFlow(req).run({}, req);
    respondWorkflow(null, wfres, req, res);
  })
);

router.post(
  "/edit",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wfres = await pageFlow(req).run(req.body, req);
    const page =
      wfres.context && (await Page.findOne({ name: wfres.context.name }));

    respondWorkflow(page, wfres, req, res);
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
      for (const role of roles) {
        await getState().setConfig(
          role.role + "_home",
          valres.success[role.role]
        );
      }
      req.flash("success", req.__(`Root pages updated`));
    } else req.flash("danger", req.__(`Error reading pages`));
    res.redirect(`/pageedit`);
  })
);
