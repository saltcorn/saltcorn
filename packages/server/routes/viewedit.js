const Router = require("express-promise-router");

const {
  renderForm,
  mkTable,
  link,
  post_btn,
  post_delete_btn,
  renderBuilder
} = require("@saltcorn/markup");
const { span, h5, h4, nbsp, p, a, div } = require("@saltcorn/markup/tags");

const { getState } = require("@saltcorn/data/db/state");
const { setTenant, isAdmin } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");

const router = new Router();
module.exports = router;

router.get("/", setTenant, isAdmin, async (req, res) => {
  var views = await View.find({}, { orderBy: "name" });
  const tables = await Table.find();
  const getTable = tid => tables.find(t => t.id === tid).name;
  const viewMarkup =
    views.length > 0
      ? mkTable(
          [
            { label: "Name", key: "name" },
            { label: "Template", key: "viewtemplate" },
            { label: "Table", key: r => getTable(r.table_id) },
            {
              label: "Run",
              key: r => link(`/view/${encodeURIComponent(r.name)}`, "Run")
            },
            {
              label: "Edit",
              key: r =>
                link(`/viewedit/edit/${encodeURIComponent(r.name)}`, "Edit")
            },
            {
              label: "Delete",
              key: r =>
                post_delete_btn(
                  `/viewedit/delete/${encodeURIComponent(r.id)}`,
                  "Delete"
                )
            }
          ],
          views
        )
      : div(
          h4("No views defined"),
          p("Views define how table rows are displayed to the user")
        );
  res.sendWrap(
    `Views`,
    viewMarkup,
    a({ href: `/viewedit/new`, class: "btn btn-primary" }, "Add view")
  );
});

const viewForm = (tableOptions, values) =>
  new Form({
    action: "/viewedit/save",
    blurb: "First, please give some basic information about your new view.",
    fields: [
      new Field({ label: "View name", name: "name", type: "String" }),
      new Field({
        label: "Template",
        name: "viewtemplate",
        input_type: "select",
        sublabel: "Views are based on a view template",
        options: Object.keys(getState().viewtemplates)
      }),
      new Field({
        label: "Table",
        name: "table_name",
        input_type: "select",
        sublabel: "Display data from this table",
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

router.get("/edit/:viewname", setTenant, isAdmin, async (req, res) => {
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

router.get("/new", setTenant, isAdmin, async (req, res) => {
  const tables = await Table.find();
  const tableOptions = tables.map(t => t.name);
  const form = viewForm(tableOptions);
  if (req.query && req.query.table) {
    form.values.table_name = req.query.table;
  }
  res.sendWrap(`Edit view`, renderForm(form));
});

router.post("/save", setTenant, isAdmin, async (req, res) => {
  const tables = await Table.find();
  const tableOptions = tables.map(t => t.name);
  const form = viewForm(tableOptions);
  const result = form.validate(req.body);

  if (result.success) {
    if (result.success.name.replace(" ", "") === "") {
      form.errors.name = "Name required";
      form.hasErrors = true;
      res.sendWrap(`Edit view`, renderForm(form));
    } else {
      if (typeof req.body.id === "undefined") {
        const existing_views = await View.find();
        const view_names = existing_views.map(v => v.name);
        if (view_names.includes(result.success.name)) {
          form.errors.name = "A view with this name already exists";
          form.hasErrors = true;
          res.sendWrap(`Edit view`, renderForm(form));
          return;
        }
      }

      var v = result.success;

      const table = await Table.findOne({ name: v.table_name });

      v.table_id = table.id;

      delete v.table_name;

      if (typeof req.body.id !== "undefined") {
        await View.update(v, req.body.id);
      } else {
        const vt = getState().viewtemplates[v.viewtemplate];
        if (vt.initial_config) v.configuration = await vt.initial_config(v);
        else v.configuration = {};
        await View.create(v);
      }
      res.redirect(`/viewedit/config/${encodeURIComponent(v.name)}`);
    }
  } else {
    res.sendWrap(`Edit view`, renderForm(form));
  }
});

router.get("/config/:name", setTenant, isAdmin, async (req, res) => {
  const { name } = req.params;

  const view = await View.findOne({ name });
  const configFlow = await view.get_config_flow();
  const wfres = await configFlow.run({
    table_id: view.table_id,
    viewname: name,
    ...view.configuration
  });
  if (wfres.renderForm)
    res.sendWrap(`View configuration`, renderForm(wfres.renderForm));
  else if (wfres.renderBuilder)
    res.sendWrap(`View configuration`, renderBuilder(wfres.renderBuilder));
  else res.redirect(wfres.redirect);
});

router.post("/config/:name", setTenant, isAdmin, async (req, res) => {
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

router.post("/delete/:id", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;
  await View.delete({ id });
  res.redirect(`/viewedit`);
});
