const Router = require("express-promise-router");

const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn
} = require("@saltcorn/markup");
const { setTenant, isAdmin } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const { span, h5, h4, nbsp, p, a, div } = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

const roleOptions = [
  { value: 1, label: "Admin" },
  { value: 4, label: "Staff" },
  { value: 8, label: "User" },
  { value: 10, label: "Public" }
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

router.get("/new/", setTenant, isAdmin, async (req, res) => {
  res.sendWrap(
    `New table`,
    renderForm(
      new Form({
        action: "/table",
        submitLabel: "Create",
        fields: [{ label: "Table name", name: "name", input_type: "text" }]
      })
    )
  );
});

router.get("/:id", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;
  const table = await Table.findOne({ id });

  const fields = await Field.find({ table_id: id }, { orderBy: "name" });
  var fieldCard;
  if (fields.length === 0) {
    fieldCard = [
      h4(`No fields defined in ${table.name} table`),
      p("Fields define the columns in your table."),
      a(
        { href: `/field/new/${table.id}`, class: "btn btn-primary" },
        "Add field to table"
      )
    ];
  } else {
    const tableHtml = mkTable(
      [
        { label: "Label", key: "label" },
        { label: "Required", key: r => (r.required ? "true" : "false") },
        {
          label: "Type",
          key: r =>
            r.type === "Key" ? `Key to ${r.reftable_name}` : r.type.name
        },
        { label: "Edit", key: r => link(`/field/${r.id}`, "Edit") },
        {
          label: "Delete",
          key: r => post_delete_btn(`/field/delete/${r.id}`)
        }
      ],
      fields
    );
    fieldCard = [
      tableHtml,
      a(
        { href: `/field/new/${table.id}`, class: "btn btn-primary" },
        "Add field"
      )
    ];
  }
  res.sendWrap(`${table.name} table`, {
    above: [
      {
        type: "pageHeader",
        title: `${table.name} table`,
        blurb:
          fields.length > 0 ? link(`/list/${table.name}`, "See data") : null
      },
      {
        type: "card",
        title: "Fields",
        contents: fieldCard
      },
      {
        type: "card",
        title: "Edit table properties",
        contents: renderForm(tableForm(table))
      }
    ]
  });
});

router.post("/", setTenant, isAdmin, async (req, res) => {
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

router.post("/delete/:id", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;
  const t = await Table.findOne({ id });
  await t.delete();
  req.flash("success", `Table ${t.name} deleted`);

  res.redirect(`/table`);
});

router.get("/", setTenant, isAdmin, async (req, res) => {
  const rows = await Table.find({}, { orderBy: "name" });
  res.sendWrap(
    "Tables",
    rows.length > 0
      ? mkTable(
          [
            { label: "Name", key: "name" },
            { label: "Edit", key: r => link(`/table/${r.id}`, "Edit") },
            {
              label: "Delete",
              key: r => post_delete_btn(`/table/delete/${r.id}`)
            }
          ],
          rows
        )
      : div(
          h4("No tables defined"),
          p("Tables hold collections of similar data")
        ),
    a({ href: `/table/new`, class: "btn btn-primary" }, "New table")
  );
});
