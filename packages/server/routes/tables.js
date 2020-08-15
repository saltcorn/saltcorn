const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
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
  i,
  form,
  label,
  input
} = require("@saltcorn/markup/tags");
const stringify = require("csv-stringify");
const fs = require("fs").promises;

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
      },
      {
        label: "Version history",
        name: "versioned",
        type: "Bool"
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
    res.sendWrap(`New table`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: "Tables", href: "/table" }, { text: "Create table" }]
        },
        {
          type: "card",
          title: `New table`,
          contents: renderForm(
            new Form({
              action: "/table",
              submitLabel: "Create",
              fields: [
                {
                  label: "Table name",
                  name: "name",
                  input_type: "text",
                  required: true
                }
              ]
            }),
            req.csrfToken()
          )
        }
      ]
    });
  })
);

router.get(
  "/create-from-csv",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(`Create table from CSV file`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: "Tables", href: "/table" },
            { text: "Create from CSV" }
          ]
        },
        {
          type: "card",
          title: `Create table from CSV file`,
          contents: renderForm(
            new Form({
              action: "/table/create-from-csv",
              submitLabel: "Create",
              fields: [
                { label: "Table name", name: "name", input_type: "text" },
                { label: "File", name: "file", input_type: "file" }
              ]
            }),
            req.csrfToken()
          )
        }
      ]
    });
  })
);

router.post(
  "/create-from-csv",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    if (req.body.name && req.files.file) {
      const newPath = File.get_new_path();
      await req.files.file.mv(newPath);
      const parse_res = await Table.create_from_csv(req.body.name, newPath);
      await fs.unlink(newPath);
      if (parse_res.error) req.flash("error", parse_res.error);
      else
        req.flash(
          "success",
          `Created table ${parse_res.table.name}. ${parse_res.success}`
        );
      res.redirect(`/table/${parse_res.table.id}`);
    } else {
      req.flash("error", "Error: missing name or file");
      res.redirect(`/table`);
    }
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
          "Download CSV"
        )
      ),
      div(
        { class: "mx-auto" },
        form(
          {
            method: "post",
            action: `/table/upload_to_table/${table.name}`,
            encType: "multipart/form-data"
          },
          input({ type: "hidden", name: "_csrf", value: req.csrfToken() }),
          label(
            { class: "btn-link", for: "upload_to_table" },
            i({ class: "fas fa-2x fa-upload" }),
            "<br/>",
            "Upload CSV"
          ),
          input({
            id: "upload_to_table",
            name: "file",
            type: "file",
            accept: "text/csv,.csv",
            onchange: "this.form.submit();"
          })
        )
      )
    );
    res.sendWrap(`${table.name} table`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: "Tables", href: "/table" }, { text: table.name }]
        },
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
      const existing_tables = [
        "users",
        ...alltables.map(t => db.sqlsanitize(t.name).toLowerCase())
      ];
      if (existing_tables.includes(db.sqlsanitize(name).toLowerCase())) {
        req.flash("error", `Table ${name} already exists`);
        res.redirect(`/table/new`);
      } else if (db.sqlsanitize(name) === "") {
        req.flash("error", `Invalid table name ${name}`);
        res.redirect(`/table/new`);
      } else {
        const table = await Table.create(name, rest);
        req.flash("success", `Table ${name} created`);
        res.redirect(`/table/${table.id}`);
      }
    } else {
      const { id, _csrf, ...rest } = v;
      const table = await Table.findOne({ id: parseInt(id) });
      if (!rest.versioned) rest.versioned = false;
      await table.update(rest);
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
    const mainCard =
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
          );
    const createCard = div(
      a({ href: `/table/new`, class: "btn btn-primary" }, "New table"),
      a(
        { href: `/table/create-from-csv`, class: "btn btn-secondary mx-3" },
        "Create from CSV upload"
      )
    );
    res.sendWrap("Tables", {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: "Tables" }]
        },
        {
          type: "pageHeader",
          title: `Tables`
        },
        {
          type: "card",
          title: "Your tables",
          contents: mainCard
        },
        {
          type: "card",
          title: "Create table",
          contents: createCard
        }
      ]
    });
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

    stringify(rows, {
      header: true,
      cast: {
        date: value => value.toISOString()
      }
    }).pipe(res);
  })
);

router.post(
  "/upload_to_table/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = await Table.findOne({ name });
    const newPath = File.get_new_path();
    await req.files.file.mv(newPath);
    //console.log(req.files.file.data)
    try {
      const parse_res = await table.import_csv_file(newPath);
      if (parse_res.error) req.flash("error", parse_res.error);
      else req.flash("success", parse_res.success);
    } catch (e) {
      req.flash("error", e.message);
    }

    await fs.unlink(newPath);
    res.redirect(`/table/${table.id}`);
  })
);
