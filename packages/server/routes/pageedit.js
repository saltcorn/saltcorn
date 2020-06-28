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

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn,
  renderBuilder
} = require("@saltcorn/markup");
const router = new Router();
module.exports = router;

const pageFlow = new Workflow({
  action: "/pageedit/edit/",
  onDone: async context => {
    const { id, columns, ...pageRow } = context;
    pageRow.min_role = +pageRow.min_role;
    if (!pageRow.fixed_states) pageRow.fixed_states = {};
    if (id) {
      await Page.update(id, pageRow);
    } else await Page.create(pageRow);
    return { redirect: `/pageedit` };
  },
  steps: [
    {
      name: "page",
      form: async context => {
        const roles = await User.get_roles();

        return new Form({
          fields: [
            new Field({
              label: "Name",
              name: "name",
              sublabel: "A short name that will be in your URL",
              input_type: "text"
            }),
            new Field({
              label: "Title",
              name: "title",
              sublabel: "Page title",
              input_type: "text"
            }),
            new Field({
              label: "Description",
              name: "description",
              sublabel: "A longer description",
              input_type: "text"
            }),
            {
              name: "min_role",
              label: "Role required to access page",
              input_type: "select",
              options: roles.map(r => ({ value: r.id, label: r.role }))
            }
          ]
        });
      }
    },
    {
      name: "layout",
      builder: async context => {
        const views = await View.find();
        const images = await File.find({ mime_super: "image" });

        return {
          views,
          images,
          mode: "page"
        };
      }
    },
    {
      name: "fixed_states",
      contextField: "fixed_states",
      onlyWhen: async context => {
        const p=new Page(context)
        const vs = await p.getViews()
        return vs.filter(v=>v.state==='fixed').length>0
      },
      form: async context => {
        const p=new Page(context)
        const vs = await p.getViews()
        const fixedvs=vs.filter(vseg=>vseg.state==='fixed')
        const fields=[]
        for(const vseg of fixedvs) {
          const v = await View.findOne({name:vseg.view})
          const fs = await v.get_state_fields()
          for(const frec of fs) {
            const f = new Field(frec)
            f.required = false;
            if (f.type && f.type.name === "Bool") f.fieldview = "tristate";
            f.parent_field=vseg.name

            await f.fill_fkey_options(true);
            fields.push(f)
          };
        }
        return new Form({
          blurb: "Set fixed states for views",
          fields
        })
      }
    }
  ]
});

router.get("/", setTenant, isAdmin, async (req, res) => {
  const rows = await Page.find({}, { orderBy: "name" });
  const roles = await User.get_roles();
  res.sendWrap(
    "Files",
    mkTable(
      [
        { label: "Name", key: "name" },
        {
          label: "Role to access",
          key: row => {
            const role = roles.find(r => r.id === row.min_role);
            return role ? role.role : "?";
          }
        },

        {
          label: "Run",
          key: r => link(`/page/${r.name}`, "Run")
        },
        {
          label: "Edit",
          key: r => link(`/pageedit/edit/${r.name}`, "Edit")
        },
        {
          label: "Delete",
          key: r => post_delete_btn(`/pageedit/delete/${r.id}`, req.csrfToken())
        }
      ],
      rows
    ),
    a(
      {
        href: `/pageedit/new`,
        class: "btn btn-primary"
      },
      "Add page"
    )
  );
});

router.get(
  "/edit/:pagename",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    const page = await Page.findOne({ name: pagename });
    const wfres = await pageFlow.run(page);

    res.sendWrap(`Edit page`, renderForm(wfres.renderForm, req.csrfToken()));
  })
);

router.get(
  "/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wfres = await pageFlow.run({});
    res.sendWrap(`New page`, renderForm(wfres.renderForm, req.csrfToken()));
  })
);

router.post(
  "/edit",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wfres = await pageFlow.run(req.body);
    if (wfres.renderForm)
      res.sendWrap(
        `Page attributes`,
        renderForm(wfres.renderForm, req.csrfToken())
      );
    else if (wfres.renderBuilder)
      res.sendWrap(
        `Page configuration`,
        renderBuilder(wfres.renderBuilder, req.csrfToken())
      );
    else res.redirect(wfres.redirect);
  })
);
