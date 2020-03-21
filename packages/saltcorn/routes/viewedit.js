const Router = require("express-promise-router");

const db = require("../db");
const viewtemplates = require("../viewtemplates");
const { renderForm, mkTable, link, post_btn } = require("../markup");
const State = require("../db/state");
const { isAdmin } = require("./utils.js");
const Form = require("../models/form");
const Field = require("../models/field");
const Table = require("../models/table");
const View = require("../models/view");
const Workflow = require("../models/workflow");

const router = new Router();
module.exports = router;

router.get("/list", isAdmin, async (req, res) => {
  var views = await View.find();
  const tables = await Table.find();
  const getTable = tid => tables.find(t => t.id === tid).name;
  res.sendWrap(
    `Views`,

    mkTable(
      [
        { label: "Name", key: "name" },
        { label: "Template", key: "viewtemplate" },
        { label: "Table", key: r => getTable(r.table_id) },
        { label: "Run", key: r => link(`/view/${r.name}`, "Run") },
        { label: "Edit", key: r => link(`/viewedit/edit/${r.name}`, "Edit") },
        {
          label: "Delete",
          key: r => post_btn(`/viewedit/delete/${r.name}`, "Delete")
        }
      ],
      views
    ),
    link(`/viewedit/new`, "New view")
  );
});

const viewForm = (tableOptions, values) =>
  new Form({
    action: "/viewedit/config",
    fields: [
      new Field({ label: "Name", name: "name", input_type: "text" }),
      new Field({
        label: "Template",
        name: "viewtemplate",
        input_type: "select",
        options: Object.keys(viewtemplates)
      }),
      new Field({
        label: "Table",
        name: "table_name",
        input_type: "select",
        options: tableOptions
      }),
      new Field({
        label: "Publicly viewable",
        name: "is_public",
        type: "Bool"
      }),
      new Field({
        label: "On root page",
        name: "on_root_page",
        type: "Bool"
      }),
      new Field({
        label: "On menu",
        name: "on_menu",
        type: "Bool"
      })
    ],
    values
  });

const viewFlow = new Workflow({
  action: "/viewedit/",
  onDone: async context => {
    const {
      id,
      name,
      viewtemplate,
      table_name,
      is_public,
      on_root_page,
      on_menu
    } = context;
    const table = await Table.findOne({ name: table_name });
    const view = viewtemplates[viewtemplate];
    const config_fields = await view.configuration_form(table_name);
    var configuration = {};
    config_fields.forEach(cf => {
      configuration[cf.name] = context[cf.name];
    });
    if (id) {
      await db.update(
        "views",
        {
          viewtemplate,
          name,
          configuration,
          table_id: table.id,
          is_public,
          on_root_page,
          on_menu
        },
        id
      );
    } else {
      await db.insert("views", {
        viewtemplate,
        name,
        configuration,
        is_public,
        on_root_page,
        on_menu,
        table_id: table.id
      });
    }
    await State.refresh();
    return { redirect: `/viewedit/list` };
  },
  steps: [
    {
      name: "view",
      form: async () => {
        const tables = await Table.find();
        const tableOptions = tables.map(t => t.name);
        return viewForm(tableOptions);
      }
    },
    {
      name: "config",
      form: async context => {
        const view = viewtemplates[context.viewtemplate];
        const config_fields = await view.configuration_form(context.table_name);
        return new Form({
          fields: config_fields.map(f => new Field(f))
        });
      }
    }
  ]
});

router.get("/edit/:viewname", isAdmin, async (req, res) => {
  const { viewname } = req.params;

  const { configuration, ...viewrow } = await db.selectOne("views", {
    name: viewname
  });
  const table = await Table.findOne({ id: viewrow.table_id });
  const wfres = await viewFlow.run({
    table_name: table.name,
    ...viewrow,
    ...configuration
  });
  res.sendWrap(`New field`, renderForm(wfres.renderForm));
});

router.get("/new", isAdmin, async (req, res) => {
  const wfres = await viewFlow.run();
  res.sendWrap(`New field`, renderForm(wfres.renderForm));
});

router.post("/", isAdmin, async (req, res) => {
  const wfres = await viewFlow.run(req.body);
  if (wfres.renderForm) res.sendWrap(`New view`, renderForm(wfres.renderForm));
  else res.redirect(wfres.redirect);
});

router.post("/delete/:name", isAdmin, async (req, res) => {
  const { name } = req.params;

  await db.deleteWhere("views", { name });
  await State.refresh();

  res.redirect(`/viewedit/list`);
});
