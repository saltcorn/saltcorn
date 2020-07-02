const Router = require("express-promise-router");

const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const View = require("@saltcorn/data/models/view");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn
} = require("@saltcorn/markup");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const {
  span,
  h5,
  h4,
  h3,
  nbsp,
  p,
  a,
  div,
  i
} = require("@saltcorn/markup/tags");
const stringify = require("csv-stringify");

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

router.get(
  "/new/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(
      `New table`,
      renderForm(
        new Form({
          action: "/table",
          submitLabel: "Create",
          fields: [{ label: "Table name", name: "name", input_type: "text" }]
        }),
        req.csrfToken()
      )
    );
  })
);

router.get(
  "/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });
    const nrows = await table.countRows();
    const fields = await Field.find({ table_id: id }, { orderBy: "name" });
    var fieldCard;
    if (fields.length === 0) {
      fieldCard = [
        h4(`No fields defined in ${table.name} table`),
        p("Fields define the columns in your table."),
        a(
          {
            href: `/field/new/${table.id}`,
            class: "btn btn-primary add-field"
          },
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
              r.type === "Key"
                ? `Key to ${r.reftable_name}`
                : r.type.name || r.type
          },
          { label: "Edit", key: r => link(`/field/${r.id}`, "Edit") },
          {
            label: "Delete",
            key: r => post_delete_btn(`/field/delete/${r.id}`, req.csrfToken())
          }
        ],
        fields
      );
      fieldCard = [
        tableHtml,
        a(
          {
            href: `/field/new/${table.id}`,
            class: "btn btn-primary add-field"
          },
          "Add field"
        )
      ];
    }
    var viewCard;
    if (fields.length > 0) {
      const views = await View.find({ table_id: table.id });
      var viewCardContents;
      if (views.length > 0) {
        viewCardContents = mkTable(
          [
            { label: "Name", key: "name" },
            { label: "Template", key: "viewtemplate" },
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
                  req.csrfToken()
                )
            }
          ],
          views
        );
      } else {
        viewCardContents = div(
          h4("No views defined"),
          p("Views define how table rows are displayed to the user")
        );
      }
      viewCard = {
        type: "card",
        title: "Views of this table",
        contents:
          viewCardContents +
          a(
            {
              href: `/viewedit/new?table=${encodeURIComponent(table.name)}`,
              class: "btn btn-primary"
            },
            "Add view"
          )
      };
    }
    const dataCard = div(
      { class: "d-flex text-center" },
      div({ class: "mx-auto" }, h4(`${nrows}`), "Rows"),
      div(
        { class: "mx-auto" },
        a(
          { href: `/list/${table.name}` },
          i({ class: "fas fa-2x fa-edit" }),
          "<br/>",
          "Edit"
        )
      ),
      div(
        { class: "mx-auto" },
        a(
          { href: `/table/download/${table.name}` },
          i({ class: "fas fa-2x fa-download" }),
          "<br/>",
          "Download"
        )
      )
    );
    res.sendWrap(`${table.name} table`, {
      above: [
        {
          type: "pageHeader",
          title: `${table.name} table`
        },
        {
          type: "card",
          title: "Fields",
          contents: fieldCard
        },
        ...(fields.length > 0
          ? [
              {
                type: "card",
                title: "Table data",
                contents: dataCard
              }
            ]
          : []),
        ...(viewCard ? [viewCard] : []),
        {
          type: "card",
          title: "Edit table properties",
          contents: renderForm(tableForm(table), req.csrfToken())
        }
      ]
    });
  })
);

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
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
      const alltables = await Table.find({});
      const existing_tables = ["users", ...alltables.map(t => t.name)];
      if (!existing_tables.includes(name)) {
        const table = await Table.create(name, rest);
        req.flash("success", `Table ${name} created`);
        res.redirect(`/table/${table.id}`);
      } else {
        req.flash("error", `Table ${name} already exists`);
        res.redirect(`/table/new`);
      }
    } else {
      const { id, _csrf, ...rest } = v;
      await Table.update(parseInt(id), rest);
      res.redirect(`/table/${id}`);
    }
  })
);

router.post(
  "/delete/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const t = await Table.findOne({ id });
    try {
      await t.delete();
      req.flash("success", `Table ${t.name} deleted`);
      res.redirect(`/table`);
    } catch (err) {
      req.flash("error", err.message);
      res.redirect(`/table`);
    }
  })
);

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
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
                key: r =>
                  post_delete_btn(`/table/delete/${r.id}`, req.csrfToken())
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
  })
);

router.get(
  "/download/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = await Table.findOne({ name });
    const rows = await table.getRows();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Pragma", "no-cache");

    stringify(rows, { header: true, cast: {
      date: (value) =>
        value.toISOString()
      
    } }).pipe(res);
  })
);
