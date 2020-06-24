const Router = require("express-promise-router");

const View = require("@saltcorn/data/models/view");
const Field = require("@saltcorn/data/models/field");
const Page = require("@saltcorn/data/models/page");
const { div, a } = require("@saltcorn/markup/tags");
const { getState } = require("@saltcorn/data/db/state");
const { setTenant } = require("../routes/utils.js");
const User = require("@saltcorn/data/models/user");
const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn
} = require("@saltcorn/markup");
const router = new Router();
module.exports = router;

const pageFlow = new Workflow({
  action: "/pageedit/edit/",
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
        return {
          views,
          mode: "page"
        };
      }
    }
  ]
});

router.get("/", setTenant, async (req, res) => {
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
          key: r => link(`/page/${r.id}`, "Run")
        },
        {
          label: "Edit",
          key: r => link(`/pageedit/edit/${r.id}`, "Edit")
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

router.get("/edit/:pagename", setTenant, async (req, res) => {
  const { pagename } = req.params;
});

router.get("/new", setTenant, async (req, res) => {
  const wfres = await pageFlow.run({});
  res.sendWrap(`New page`, renderForm(wfres.renderForm, req.csrfToken()));
});
