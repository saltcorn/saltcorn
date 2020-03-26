const Router = require("express-promise-router");

const { renderForm, mkTable, link, post_btn } = require("saltcorn-markup");
const State = require("saltcorn-data/db/state");
const { isAdmin } = require("./utils.js");
const Form = require("saltcorn-data/models/form");
const Field = require("saltcorn-data/models/field");
const Table = require("saltcorn-data/models/table");
const View = require("saltcorn-data/models/view");
const Workflow = require("saltcorn-data/models/workflow");

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
    action: "/viewedit/save",
    blurb: "First, please give some basic information about your new view.",
    fields: [
      new Field({ label: "Name", name: "name", input_type: "text" }),
      new Field({
        label: "Template",
        name: "viewtemplate",
        input_type: "select",
        options: Object.keys(State.viewtemplates)
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

router.get("/edit/:viewname", isAdmin, async (req, res) => {
  const { viewname } = req.params;

  var viewrow = await View.findOne({ name: viewname });

  const tables = await Table.find();
  const currentTable = tables.find(t => t.id === viewrow.table_id);
  viewrow.table_name = currentTable.name;
  const tableOptions = tables.map(t => t.name);
  const form = viewForm(tableOptions, viewrow);
  form.hidden("id");
  res.sendWrap(`Edit view`, renderForm(form));
});

router.get("/new", isAdmin, async (req, res) => {
  const tables = await Table.find();
  const tableOptions = tables.map(t => t.name);
  res.sendWrap(`Edit view`, renderForm(viewForm(tableOptions)));
});

router.post("/save", isAdmin, async (req, res) => {
  var v = { ...req.body };

  const table = await Table.findOne({ name: v.table_name });

  v.table_id = table.id;

  delete v.table_name;

  if (typeof v.id !== "undefined") {
    await View.update(v, v.id);
  } else {
    v.configuration = {};
    await View.create(v);
  }
  res.redirect(`/viewedit/config/${v.name}`);
});

router.get("/config/:name", isAdmin, async (req, res) => {
  const { name } = req.params;

  const view = await View.findOne({ name });
  const configFlow = await view.get_config_flow();
  const wfres = await configFlow.run({
    table_id: view.table_id,
    ...view.configuration
  });
  if (wfres.renderForm)
    res.sendWrap(`View configuration`, renderForm(wfres.renderForm));
  else res.redirect(wfres.redirect);
});

router.post("/config/:name", isAdmin, async (req, res) => {
  const { name } = req.params;

  const view = await View.findOne({ name });
  const configFlow = await view.get_config_flow();
  const wfres = await configFlow.run(req.body);

  if (wfres.renderForm)
    res.sendWrap(`View configuration`, renderForm(wfres.renderForm));
  else {
    res.redirect(wfres.redirect);
  }
});

router.post("/delete/:name", isAdmin, async (req, res) => {
  const { name } = req.params;
  await View.delete({ name });
  res.redirect(`/viewedit/list`);
});
