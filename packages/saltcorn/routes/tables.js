const Router = require("express-promise-router");

const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const { isAdmin } = require("./utils.js");
const Form = require("saltcorn-data/models/form");
const { span, h5 } = require("saltcorn-markup/tags");

const router = new Router();
module.exports = router;

const roleOptions = [
  { value: 1, label: "Admin" },
  { value: 2, label: "Staff" },
  { value: 3, label: "User" },
  { value: 4, label: "Public" }
];

const apiOptions = [
  { value: "No API", label: "No API" },
  { value: "Read only", label: "Read only" },
  { value: "Read and write", label: "Read and write" }
];

const tableForm = table => {
  const form = new Form({
    action: "/table",
    fields: [
      {
        label: "API access",
        sublabel:
          "APIs allow developers access to your data without using a user interface",
        name: "api_access",
        input_type: "select",
        options: apiOptions
      },
      {
        label: "Minimum role for read",
        name: "min_role_read",
        input_type: "select",
        options: roleOptions
      },
      {
        label: "Minimum role for writing",
        name: "min_role_write",
        input_type: "select",
        options: roleOptions
      }
    ]
  });
  if (table) {
    if (table.id) form.hidden("id");
    form.values = table;
    if (table.expose_api_read && table.expose_api_write)
      form.values.api_access = "Read and write";
    else if (table.expose_api_read) form.values.api_access = "Read only";
    else form.values.api_access = "No API";
  }
  return form;
};

router.get("/new/", isAdmin, async (req, res) => {
  res.sendWrap(
    `New table`,
    renderForm(
      new Form({
        action: "/table",
        fields: [{ label: "Name", name: "name", input_type: "text" }]
      })
    )
  );
});

router.get("/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const table = await Table.findOne({ id });

  const fields = await Field.find({ table_id: id }, { orderBy: "name" });
  const tableHtml = mkTable(
    [
      { label: "Name", key: "name" },
      { label: "Label", key: "label" },
      { label: "Required", key: "required" },
      { label: "Type", key: r => r.type.name },
      { label: "Edit", key: r => link(`/field/${r.id}`, "Edit") },
      {
        label: "Delete",
        key: r => post_btn(`/field/delete/${r.id}`, "Delete")
      }
    ],
    fields
  );
  res.sendWrap(
    `${table.name} table`,
    h5("Fields"),
    tableHtml,

    span({ class: "mr-3" }, link(`/list/${table.name}`, "List")),
    link(`/field/new/${table.id}`, "Add field"),
    h5("Edit table properties"),
    renderForm(tableForm(table))
  );
});

router.post("/", isAdmin, async (req, res) => {
  const set_api_access = v => {
    switch (v.api_access) {
      case "No API":
        v.expose_api_read = false;
        v.expose_api_write = false;
        break;
      case "Read only":
        v.expose_api_read = true;
        v.expose_api_write = false;
        break;
      case "Read and write":
        v.expose_api_read = true;
        v.expose_api_write = true;
        break;
      default:
        v.expose_api_read = false;
        v.expose_api_write = false;
        break;
    }
    delete v.api_access;
    return v;
  };
  const v = set_api_access(req.body);
  if (typeof v.id === "undefined") {
    // insert
    const { name, ...rest } = v;

    const table = await Table.create(name, rest);
    req.flash("success", `Table ${name} created`);
    res.redirect(`/table/${table.id}`);
  } else {
    const { id, ...rest } = v;
    Table.update(parseInt(id), rest);
    res.redirect(`/table/${id}`);
  }
});

router.post("/delete/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const t = await Table.findOne({ id });
  await t.delete();
  req.flash("success", `Table ${t.name} deleted`);

  res.redirect(`/table`);
});

router.get("/", isAdmin, async (req, res) => {
  const rows = await Table.find({}, { orderBy: "name" });
  res.sendWrap(
    "Tables",
    mkTable(
      [
        { label: "Name", key: "name" },
        { label: "Edit", key: r => link(`/table/${r.id}`, "Edit") },
        {
          label: "Delete",
          key: r => post_btn(`/table/delete/${r.id}`, "Delete")
        }
      ],
      rows
    ),
    link(`/table/new`, "Add table")
  );
});
