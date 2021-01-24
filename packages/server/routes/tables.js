const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const Table = require("@saltcorn/data/models/table");
const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  settingsDropdown,
  post_delete_btn,
  post_dropdown_item,
} = require("@saltcorn/markup");
const { recalculate_for_stored } = require("@saltcorn/data/models/expression");
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
  input,
  text,
} = require("@saltcorn/markup/tags");
const stringify = require("csv-stringify");
const TableConstraint = require("@saltcorn/data/models/table_constraints");
const fs = require("fs").promises;

const router = new Router();
module.exports = router;

const tableForm = async (table, req) => {
  const fields = await table.getFields();
  const roleOptions = (await User.get_roles()).map((r) => ({
    value: r.id,
    label: r.role,
  }));
  const userFields = fields
    .filter((f) => f.reftable_name === "users")
    .map((f) => ({ value: f.id, label: f.name }));
  const form = new Form({
    action: "/table",
    fields: [
      ...(userFields.length > 0
        ? [
            {
              label: req.__("Ownership field"),
              name: "ownership_field_id",
              sublabel: req.__(
                "The user referred to in this field will be the owner of the row"
              ),
              input_type: "select",
              options: [{ value: "", label: req.__("None") }, ...userFields],
            },
          ]
        : []),
      {
        label: req.__("Minimum role for read"),
        name: "min_role_read",
        input_type: "select",
        options: roleOptions,
      },
      {
        label: req.__("Minimum role for writing"),
        name: "min_role_write",
        input_type: "select",
        options: roleOptions,
      },
      {
        label: req.__("Version history"),
        name: "versioned",
        type: "Bool",
      },
    ],
  });
  if (table) {
    if (table.id) form.hidden("id");
    form.values = table;
  }
  return form;
};

router.get(
  "/new/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__(`New table`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { text: req.__("Create") },
          ],
        },
        {
          type: "card",
          title: req.__(`New table`),
          contents: renderForm(
            new Form({
              action: "/table",
              submitLabel: req.__("Create"),
              fields: [
                {
                  label: req.__("Table name"),
                  name: "name",
                  input_type: "text",
                  required: true,
                },
              ],
            }),
            req.csrfToken()
          ),
        },
      ],
    });
  })
);

router.get(
  "/create-from-csv",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.sendWrap(req.__(`Create table from CSV file`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { text: req.__("Create from CSV") },
          ],
        },
        {
          type: "card",
          title: req.__(`Create table from CSV file`),
          contents: renderForm(
            new Form({
              action: "/table/create-from-csv",
              submitLabel: req.__("Create"),
              fields: [
                {
                  label: req.__("Table name"),
                  name: "name",
                  input_type: "text",
                },
                { label: req.__("File"), name: "file", input_type: "file" },
              ],
            }),
            req.csrfToken()
          ),
        },
      ],
    });
  })
);

router.post(
  "/create-from-csv",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    if (req.body.name && req.files && req.files.file) {
      const name = req.body.name;
      const alltables = await Table.find({});
      const existing_tables = [
        "users",
        ...alltables.map((t) => db.sqlsanitize(t.name).toLowerCase()),
      ];
      if (existing_tables.includes(db.sqlsanitize(name).toLowerCase())) {
        req.flash("error", req.__(`Table %s already exists`, name));
        res.redirect(`/table/create-from-csv`);
        return;
      } else if (db.sqlsanitize(name) === "") {
        req.flash("error", req.__(`Invalid table name %s`, name));
        res.redirect(`/table/create-from-csv`);
        return;
      }
      const newPath = File.get_new_path();
      await req.files.file.mv(newPath);
      const parse_res = await Table.create_from_csv(name, newPath);
      await fs.unlink(newPath);
      if (parse_res.error) {
        req.flash("error", parse_res.error);
        res.redirect(`/table/create-from-csv`);
      } else {
        req.flash(
          "success",
          req.__(`Created table %s.`, parse_res.table.name) + parse_res.success
        );
        res.redirect(`/table/${parse_res.table.id}`);
      }
    } else {
      req.flash("error", req.__("Error: missing name or file"));
      res.redirect(`/table/create-from-csv`);
    }
  })
);

const badge = (col, lbl) =>
  `<span class="badge badge-${col}">${lbl}</span>&nbsp;`;
const typeBadges = (f, req) => {
  let s = "";
  if (f.required) s += badge("primary", req.__("Required"));
  if (f.is_unique) s += badge("success", req.__("Unique"));
  if (f.calculated) s += badge("info", req.__("Calculated"));
  if (f.stored) s += badge("warning", req.__("Stored"));
  return s;
};
const attribBadges = (f) => {
  let s = "";
  if (f.attributes) {
    Object.entries(f.attributes).forEach(([k, v]) => {
      if (["summary_field", "default"].includes(k)) return;
      if (v || v === 0) s += badge("secondary", k);
    });
  }
  return s;
};

router.get(
  "/:idorname",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { idorname } = req.params;
    let id = parseInt(idorname);
    let table;
    if (id) table = await Table.findOne({ id });
    else {
      table = await Table.findOne({ name: idorname });
      id = table.id;
    }

    if (!table) {
      req.flash("error", req.__(`Table not found`));
      res.redirect(`/table`);
      return;
    }
    const nrows = await table.countRows();
    const fields = await Field.find({ table_id: id }, { orderBy: "name" });
    const { child_relations } = await table.get_child_relations();
    const inbound_refs = [
      ...new Set(child_relations.map(({ table }) => table.name)),
    ];
    var fieldCard;
    if (fields.length === 0) {
      fieldCard = [
        h4(req.__(`No fields defined in %s table`, table.name)),
        p(req.__("Fields define the columns in your table.")),
        a(
          {
            href: `/field/new/${table.id}`,
            class: "btn btn-primary add-field",
          },
          req.__("Add field to table")
        ),
      ];
    } else {
      const tableHtml = mkTable(
        [
          { label: req.__("Label"), key: "label" },
          {
            label: req.__("Type"),
            key: (r) =>
              r.type === "Key"
                ? `Key to ` +
                  a({ href: `/table/${r.reftable_name}` }, r.reftable_name)
                : r.type.name || r.type,
          },
          {
            label: "",
            key: (r) => typeBadges(r, req),
          },
          {
            label: req.__("Attributes"),
            key: (r) => attribBadges(r),
          },
          { label: req.__("Variable name"), key: "name" },
          {
            label: req.__("Edit"),
            key: (r) => link(`/field/${r.id}`, req.__("Edit")),
          },
          {
            label: req.__("Delete"),
            key: (r) =>
              table.name === "users" && r.name === "email"
                ? ""
                : post_delete_btn(`/field/delete/${r.id}`, req, r.name),
          },
        ],
        fields
      );
      fieldCard = [
        tableHtml,
        inbound_refs.length > 0
          ? req.__("Inbound keys: ") +
            inbound_refs.map((tnm) => link(`/table/${tnm}`, tnm)).join(", ") +
            "<br>"
          : "",
        a(
          {
            href: `/field/new/${table.id}`,
            class: "btn btn-primary add-field mt-2",
          },
          req.__("Add field")
        ),
      ];
    }
    var viewCard;
    if (fields.length > 0) {
      const views = await View.find({ table_id: table.id });
      var viewCardContents;
      if (views.length > 0) {
        viewCardContents = mkTable(
          [
            { label: req.__("Name"), key: "name" },
            { label: req.__("Template"), key: "viewtemplate" },
            {
              label: req.__("Run"),
              key: (r) =>
                link(`/view/${encodeURIComponent(r.name)}`, req.__("Run")),
            },
            {
              label: req.__("Edit"),
              key: (r) =>
                link(
                  `/viewedit/edit/${encodeURIComponent(r.name)}`,
                  req.__("Edit")
                ),
            },
            {
              label: req.__("Delete"),
              key: (r) =>
                post_delete_btn(
                  `/viewedit/delete/${encodeURIComponent(r.id)}`,
                  req
                ),
            },
          ],
          views
        );
      } else {
        viewCardContents = div(
          h4(req.__("No views defined")),
          p(req.__("Views define how table rows are displayed to the user"))
        );
      }
      viewCard = {
        type: "card",
        title: req.__("Views of this table"),
        contents:
          viewCardContents +
          a(
            {
              href: `/viewedit/new?table=${encodeURIComponent(table.name)}`,
              class: "btn btn-primary",
            },
            req.__("Add view")
          ),
      };
    }
    const dataCard = div(
      { class: "d-flex text-center" },
      div({ class: "mx-auto" }, h4(`${nrows}`), req.__("Rows")),
      div(
        { class: "mx-auto" },
        a(
          { href: `/list/${table.name}` },
          i({ class: "fas fa-2x fa-edit" }),
          "<br/>",
          req.__("Edit")
        )
      ),
      div(
        { class: "mx-auto" },
        a(
          { href: `/table/download/${table.name}` },
          i({ class: "fas fa-2x fa-download" }),
          "<br/>",
          req.__("Download CSV")
        )
      ),
      div(
        { class: "mx-auto" },
        form(
          {
            method: "post",
            action: `/table/upload_to_table/${table.name}`,
            encType: "multipart/form-data",
          },
          input({ type: "hidden", name: "_csrf", value: req.csrfToken() }),
          label(
            { class: "btn-link", for: "upload_to_table" },
            i({ class: "fas fa-2x fa-upload" }),
            "<br/>",
            req.__("Upload CSV")
          ),
          input({
            id: "upload_to_table",
            name: "file",
            type: "file",
            accept: "text/csv,.csv",
            onchange: "this.form.submit();",
          })
        )
      ),
      div(
        { class: "mx-auto" },
        settingsDropdown(`dataMenuButton`, [
          a(
            {
              class: "dropdown-item",
              href: `/table/constraints/${table.id}`,
            },
            '<i class="fas fa-ban"></i>&nbsp;' + req.__("Constraints")
          ),
          post_dropdown_item(
            `/table/recalc-stored/${table.name}`,
            '<i class="fas fa-sync"></i>&nbsp;' +
              req.__("Recalculate stored fields"),
            req
          ),
          post_dropdown_item(
            `/table/delete-all-rows/${table.name}`,
            '<i class="far fa-trash-alt"></i>&nbsp;' +
              req.__("Delete all rows"),
            req,
            true
          ),
        ])
      )
    );
    const tblForm = await tableForm(table, req);
    res.sendWrap(req.__(`%s table`, table.name), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { text: table.name },
          ],
        },
        {
          type: "pageHeader",
          title: req.__(`%s table`, table.name),
        },
        {
          type: "card",
          title: req.__("Fields"),
          contents: fieldCard,
        },
        ...(fields.length > 0
          ? [
              {
                type: "card",
                title: req.__("Table data"),
                contents: dataCard,
              },
            ]
          : []),
        ...(viewCard ? [viewCard] : []),
        {
          type: "card",
          title: req.__("Edit table properties"),
          contents: renderForm(tblForm, req.csrfToken()),
        },
      ],
    });
  })
);

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const v = req.body;
    if (typeof v.id === "undefined") {
      // insert
      const { name, ...rest } = v;
      const alltables = await Table.find({});
      const existing_tables = [
        "users",
        ...alltables.map((t) => db.sqlsanitize(t.name).toLowerCase()),
      ];
      if (existing_tables.includes(db.sqlsanitize(name).toLowerCase())) {
        req.flash("error", req.__(`Table %s already exists`, name));
        res.redirect(`/table/new`);
      } else if (db.sqlsanitize(name) === "") {
        req.flash("error", req.__(`Invalid table name %s`, name));
        res.redirect(`/table/new`);
      } else {
        const table = await Table.create(name, rest);
        req.flash("success", req.__(`Table %s created`, name));
        res.redirect(`/table/${table.id}`);
      }
    } else {
      const { id, _csrf, ...rest } = v;
      const table = await Table.findOne({ id: parseInt(id) });
      const old_versioned = table.versioned;
      if (!rest.versioned) rest.versioned = false;
      await table.update(rest);
      if (!old_versioned && rest.versioned)
        req.flash(
          "success",
          req.__("Table saved with version history enabled")
        );
      else if (old_versioned && !rest.versioned)
        req.flash(
          "success",
          req.__("Table saved with version history disabled")
        );
      else req.flash("success", req.__("Table saved"));

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
    if (t.name === "users") {
      req.flash("error", req.__(`Cannot delete users table`));
      res.redirect(`/table`);
      return;
    }
    try {
      await t.delete();
      req.flash("success", req.__(`Table %s deleted`, t.name));
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
              {
                label: req.__("Name"),
                key: (r) => link(`/table/${r.id}`, text(r.name)),
              },
              {
                label: req.__("Delete"),
                key: (r) =>
                  r.name === "users"
                    ? ""
                    : post_delete_btn(`/table/delete/${r.id}`, req, r.name),
              },
            ],
            rows
          )
        : div(
            h4(req.__("No tables defined")),
            p(req.__("Tables hold collections of similar data"))
          );
    const createCard = div(
      a({ href: `/table/new`, class: "btn btn-primary" }, req.__("New table")),
      a(
        { href: `/table/create-from-csv`, class: "btn btn-secondary mx-3" },
        req.__("Create from CSV upload")
      )
    );
    res.sendWrap(req.__("Tables"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [{ text: req.__("Tables") }],
        },
        {
          type: "card",
          title: req.__("Your tables"),
          contents: mainCard,
        },
        {
          type: "card",
          title: req.__("Create table"),
          contents: createCard,
        },
      ],
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
        date: (value) => value.toISOString(),
        boolean: (v) => (v ? "true" : "false"),
      },
    }).pipe(res);
  })
);

router.get(
  "/constraints/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });
    const cons = await TableConstraint.find({ table_id: table.id });
    res.sendWrap(req.__(`%s constraints`, table.name), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: req.__("Constraints") },
          ],
        },
        {
          type: "card",
          title: req.__(`%s constraints`, table.name),
          contents: [
            mkTable(
              [
                { label: req.__("Type"), key: "type" },
                {
                  label: req.__("Fields"),
                  key: (r) => r.configuration.fields.join(", "),
                },
                {
                  label: req.__("Delete"),
                  key: (r) =>
                    post_delete_btn(`/table/delete-constraint/${r.id}`, req),
                },
              ],
              cons
            ),
            link(`/table/add-constraint/${id}`, req.__("Add constraint")),
          ],
        },
      ],
    });
  })
);

const constraintForm = (table_id, fields) =>
  new Form({
    action: `/table/add-constraint/${table_id}`,
    blurb: "Tick the boxes for the fields that should be jointly unique",
    fields: fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: "Bool",
    })),
  });

router.get(
  "/add-constraint/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });
    const fields = await table.getFields();
    const form = constraintForm(table.id, fields);
    res.sendWrap(req.__(`Add constraint to %s`, table.name), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            {
              text: req.__("Constraints"),
              href: `/table/constraints/${table.id}`,
            },
            { text: req.__("New") },
          ],
        },
        {
          type: "card",
          title: req.__(`Add constraint to %s`, table.name),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);

router.post(
  "/add-constraint/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });
    const fields = await table.getFields();
    const form = constraintForm(table.id, fields);
    form.validate(req.body);
    if (form.hasErrors) req.flash("error", req.__("An error occurred"));
    else {
      await TableConstraint.create({
        table_id: table.id,
        type: "Unique",
        configuration: {
          fields: fields.map((f) => f.name).filter((f) => form.values[f]),
        },
      });
    }
    res.redirect(`/table/constraints/${table.id}`);
  })
);

router.post(
  "/delete-constraint/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const cons = await TableConstraint.findOne({ id });
    await cons.delete();
    res.redirect(`/table/constraints/${cons.table_id}`);
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
      const parse_res = await table.import_csv_file(newPath, true);
      if (parse_res.error) req.flash("error", parse_res.error);
      else req.flash("success", parse_res.success);
    } catch (e) {
      req.flash("error", e.message);
    }

    await fs.unlink(newPath);
    res.redirect(`/table/${table.id}`);
  })
);

router.post(
  "/delete-all-rows/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = await Table.findOne({ name });

    try {
      await table.deleteRows({});
      req.flash("success", req.__("Deleted all rows"));
    } catch (e) {
      req.flash("error", e.message);
    }

    res.redirect(`/table/${table.id}`);
  })
);

router.post(
  "/recalc-stored/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = await Table.findOne({ name });

    recalculate_for_stored(table);

    req.flash("success", req.__("Started recalculating stored fields"));

    res.redirect(`/table/${table.id}`);
  })
);
