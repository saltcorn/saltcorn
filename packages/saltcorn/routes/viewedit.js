const Router = require("express-promise-router");

const db = require("../db");
const viewtemplates = require("../viewtemplates");
const { renderForm, mkTable, link, post_btn } = require("./markup.js");
const { refresh } = require("../db/state");
const { isAdmin } = require("./utils.js");
const Form = require("../models/form");
const Field = require("../db/field");

const router = new Router();
module.exports = router;

router.get("/list", isAdmin, async (req, res) => {
  var viewrows = await db.select("views");
  const tables = await db.get_tables();
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
      viewrows
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
      })
    ],
    values
  });

router.get("/edit/:viewname", isAdmin, async (req, res) => {
  const { viewname } = req.params;

  var viewrow = await db.selectOne("views", { name: viewname });

  const tables = await db.get_tables();
  const currentTable = tables.find(t => t.id === viewrow.table_id);
  viewrow.table_name = currentTable.name;
  const tableOptions = tables.map(t => t.name);
  const form = viewForm(tableOptions, viewrow);
  res.sendWrap(`Edit view`, renderForm(form));
});

router.get("/new", isAdmin, async (req, res) => {
  const tables = await db.get_tables();
  const tableOptions = tables.map(t => t.name);
  res.sendWrap(`Edit view`, renderForm(viewForm(tableOptions)));
});

router.post("/delete/:name", isAdmin, async (req, res) => {
  const { name } = req.params;

  await db.deleteWhere("views", { name });
  await refresh();

  res.redirect(`/viewedit/list`);
});

router.post("/config", isAdmin, async (req, res) => {
  const vbody = req.body;
  var viewrow = { configuration: {} };
  if (vbody.id) viewrow = await db.selectOne("views", { name: vbody.name });

  const view = viewtemplates[vbody.viewtemplate];
  const config_fields = await view.configuration_form(vbody.table_name);
  const form = new Form({
    action: "/viewedit/save",
    fields: config_fields.map(f => new Field(f)),
    values: {
      ...vbody,
      ...viewrow.configuration
    }
  });
  form.hidden("name", "viewtemplate", "table_name");
  if (vbody.id) form.hidden("id");
  res.sendWrap(`View configuration`, renderForm(form));
});

router.post("/save", isAdmin, async (req, res) => {
  const { id, name, viewtemplate, table_name } = req.body;
  const table = await db.get_table_by_name(table_name);
  const view = viewtemplates[viewtemplate];
  const config_fields = await view.configuration_form(table_name);
  var configuration = {};
  config_fields.forEach(cf => {
    configuration[cf.name] = req.body[cf.name];
  });
  if (id) {
    await db.update(
      "views",
      { viewtemplate, name, configuration, table_id: table.id },
      id
    );
  } else {
    await db.insert("views", {
      viewtemplate,
      name,
      configuration,
      table_id: table.id
    });
  }
  await refresh();
  res.redirect(`/viewedit/list`);
});
