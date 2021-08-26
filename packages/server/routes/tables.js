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
  tr,
  script,
  domReady,
  code,
} = require("@saltcorn/markup/tags");
const stringify = require("csv-stringify");
const TableConstraint = require("@saltcorn/data/models/table_constraints");
const fs = require("fs").promises;
const {
  discoverable_tables,
  discover_tables,
  implement_discovery,
} = require("@saltcorn/data/models/discovery");
const { getState } = require("@saltcorn/data/db/state");
const { cardHeaderTabs } = require("@saltcorn/markup/layout_utils");

const router = new Router();
module.exports = router;
/**
 * Show Table Form
 * @param table
 * @param req
 * @returns {Promise<Form>}
 */
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
    submitButtonClass: "btn-outline-primary",
    onChange: "remove_outline(this)",
    fields: [
      ...(userFields.length > 0 && !table.external
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
      // description of table
      {
        label: req.__("Description"),
        name: "description",
        input_type: "text",
        sublabel: req.__(
          "Description allows you to give more information about the table"
        ),
        //options: roleOptions,
      },
      {
        label: req.__("Minimum role to read"),
        sublabel: req.__(
          "User must have this role or higher to read rows from the table"
        ),
        name: "min_role_read",
        input_type: "select",
        options: roleOptions,
      },
      ...(table.external
        ? []
        : [
            {
              label: req.__("Minimum role to write"),
              name: "min_role_write",
              input_type: "select",
              sublabel: req.__(
                "User must have this role or higher to edit or create new rows in the table"
              ),
              options: roleOptions,
            },
            {
              label: req.__("Version history"),
              sublabel: req.__(
                "Version history allows to track table data changes"
              ),
              name: "versioned",
              type: "Bool",
            },
          ]),
    ],
  });
  if (table) {
    if (table.id) form.hidden("id");
    if (table.external) form.hidden("name");
    if (table.external) form.hidden("external");
    form.values = table;
  }
  return form;
};
/**
 * New table (GET handler)
 */
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
/**
 * Discover Database Tables Form
 * @param tables - list of tables
 * @param req - HTTP Request
 * @returns {Form}
 */
const discoverForm = (tables, req) => {
  return new Form({
    action: "/table/discover",
    blurb:
      tables.length > 0
        ? req.__(
            "The following tables in your database can be imported into Saltcorn:"
          )
        : req.__(
            "There are no tables in the database that can be imported into Saltcorn."
          ),
    submitLabel: req.__("Import"),
    fields: tables.map((t) => ({
      name: t.table_name,
      label: t.table_name,
      type: "Bool",
    })),
  });
};
/**
 * Table Discover (GET handler)
 */
router.get(
  "/discover",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    // get list of discoverable tables
    const tbls = await discoverable_tables();
    // create discoverable tables list form
    const form = discoverForm(tbls, req);
    res.sendWrap(req.__("Discover tables"), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { text: req.__("Discover") },
          ],
        },
        {
          type: "card",
          title: req.__("Discover tables"),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);
/**
 * Table Discover (post)
 */
router.post(
  "/discover",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const tbls = await discoverable_tables();
    const form = discoverForm(tbls, req);
    form.validate(req.body);
    const tableNames = tbls
      .filter((t) => form.values[t.table_name])
      .map((t) => t.table_name);
    const pack = await discover_tables(tableNames);
    await implement_discovery(pack);
    req.flash(
      "success",
      req.__("Discovered tables: %s", tableNames.join(", "))
    );
    res.redirect("/table");
  })
);
/**
 * Create Table from CSV file (get)
 */
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
          contents:
            renderForm(
              new Form({
                action: "/table/create-from-csv",
                class: "create-from-csv",
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
            ) +
            script(
              domReady(
                `$('form.create-from-csv button[type=submit]').click(function(){press_store_button(this)})`
              )
            ),
        },
      ],
    });
  })
);
/**
 * Create Table from CSV file (post)
 */
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
/**
 * Show Relational Diagram (get)
 */
router.get(
  "/relationship-diagram",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const tables = await Table.find_with_external({}, { orderBy: "name" });
    const edges = [];
    for (const table of tables) {
      const fields = await table.getFields();
      for (const field of fields) {
        if (field.reftable_name)
          edges.push({
            from: table.name,
            to: field.reftable_name,
            arrows: "to",
          });
      }
    }
    const data = {
      nodes: tables.map((t) => ({
        id: t.name,
        label: `<b>${t.name}</b>\n${t.fields
          .map((f) => `${f.name} : ${f.pretty_type}`)
          .join("\n")}`,
      })),
      edges,
    };
    res.sendWrap(
      {
        title: req.__("Tables"),
        headers: [
          {
            script:
              "https://unpkg.com/vis-network@9.0.2/standalone/umd/vis-network.min.js",
          },
        ],
      },
      {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [{ text: req.__("Tables") }],
          },
          {
            type: "card",
            title: cardHeaderTabs([
              { label: req.__("Your tables"), href: "/table" },
              {
                label: req.__("Relationship diagram"),
                href: "/table/relationship-diagram",
                active: true,
              },
            ]),
            contents: [
              div({ id: "erdvis" }),
              script(
                domReady(`
            var container = document.getElementById('erdvis');        
            var data = ${JSON.stringify(data)};
            var options = {
              edges: {length: 250},
              nodes: {
                font: { align: 'left', multi: "html", size: 20 },
                shape: "box"
              },
              physics: {
                // Even though it's disabled the options still apply to network.stabilize().
                enabled: false,
                solver: "repulsion",
                repulsion: {
                  nodeDistance: 100 // Put more distance between the nodes.
                }
              }
            };        
            var network = new vis.Network(container, data, options);
            network.stabilize();`)
              ),
            ],
          },
        ],
      }
    );
  })
);

const badge = (col, lbl) =>
  `<span class="badge badge-${col}">${lbl}</span>&nbsp;`;
const typeBadges = (f, req) => {
  let s = "";
  if (f.primary_key) s += badge("warning", req.__("Primary key"));
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
/**
 * Table Constructor (GET Handler)
 */
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
    }

    if (!table) {
      req.flash("error", req.__(`Table not found`));
      res.redirect(`/table`);
      return;
    }
    id = table.id;
    const nrows = await table.countRows();
    const fields = await table.getFields();
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
                : (r.type && r.type.name) || r.type,
          },
          {
            label: "",
            key: (r) => typeBadges(r, req),
          },
          {
            label: req.__("Attributes"),
            key: (r) => attribBadges(r),
          },
          { label: req.__("Variable name"), key: (t) => code(t.name) },
          ...(table.external
            ? []
            : [
                {
                  label: req.__("Edit"),
                  key: (r) => link(`/field/${r.id}`, req.__("Edit")),
                },
              ]),
          ...(table.external || db.isSQLite
            ? []
            : [
                {
                  label: req.__("Delete"),
                  key: (r) =>
                    (table.name === "users" && r.name === "email") ||
                    r.primary_key
                      ? ""
                      : post_delete_btn(`/field/delete/${r.id}`, req, r.name),
                },
              ]),
        ],
        fields,
        { hover: true }
      );
      fieldCard = [
        tableHtml,
        inbound_refs.length > 0
          ? req.__("Inbound keys: ") +
            inbound_refs.map((tnm) => link(`/table/${tnm}`, tnm)).join(", ") +
            "<br>"
          : "",
        !table.external &&
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
          views,
          { hover: true }
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
            req.__("Create view")
          ),
      };
    }
    // Table Data card
    const dataCard = div(
      { class: "d-flex text-center" },
      div({ class: "mx-auto" }, h4(`${nrows}`), req.__("Rows")),
      div(
        { class: "mx-auto" },
        a(
          // TBD Decide about edit of users table data - currently doesnt work - I had put link to useradmin
          {
            href:
              table.name === "users"
                ? `/useradmin/`
                : fields.length === 1
                ? `javascript:;` // Fix problem with edition of table with only one column ID / Primary Key
                : `/list/${table.name}`,
          },
          i({ class: "fas fa-2x fa-edit" }),
          "<br/>",
          // Fix problem with edition of table with only one column ID / Primary Key -
          fields.length === 1
            ? req.__("Add more fields to enable edit")
            : req.__("Edit")
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
      !table.external &&
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
      // only if table is not external
      !table.external &&
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
            // rename table doesnt supported for sqlite
            !db.isSQLite &&
              a(
                {
                  class: "dropdown-item",
                  href: `/table/rename/${table.id}`,
                },
                '<i class="fas fa-edit"></i>&nbsp;' + req.__("Rename table")
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
    // add table form
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
/**
 *
 */
router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const v = req.body;
    if (typeof v.id === "undefined" && typeof v.external === "undefined") {
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
    } else if (v.external) {
      //we can only save min role
      const table = await Table.findOne(v.name);
      if (table) {
        const exttables_min_role_read = getState().getConfigCopy(
          "exttables_min_role_read",
          {}
        );
        exttables_min_role_read[table.name] = +v.min_role_read;
        await getState().setConfig(
          "exttables_min_role_read",
          exttables_min_role_read
        );
        req.flash("success", req.__("Table saved"));
        res.redirect(`/table/${table.name}`);
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
/**
 * Delete Table Route Handler definition
 * /delete:/id, where id is table id in _sc_tables
 */
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
/**
 * Table badges to show in System Table list views
 * Currently supports:
 * - Owned - if ownership_field_id? What is it?
 * - History - if table has versioning
 * - External - if this is external table
 * @param t - table object
 * @param req - http request
 * @returns {string} - html string with list of badges
 */
const tableBadges = (t, req) => {
  let s = "";
  if (t.ownership_field_id) s += badge("primary", req.__("Owned"));
  if (t.versioned) s += badge("success", req.__("History"));
  if (t.external) s += badge("info", req.__("External"));
  return s;
};
/**
 * List Views of Tables (GET Handler)
 *
 */
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const rows = await Table.find_with_external({}, { orderBy: "name" });
    const roles = await User.get_roles();
    const getRole = (rid) => roles.find((r) => r.id === rid).role;
    const mainCard =
      rows.length > 0
        ? mkTable(
            [
              {
                label: req.__("Name"),
                key: (r) => link(`/table/${r.id || r.name}`, text(r.name)),
              },
              {
                label: "",
                key: (r) => tableBadges(r, req),
              },
              {
                label: req.__("Access Read/Write"),
                key: (t) =>
                  t.external
                    ? `${getRole(t.min_role_read)} (read only)`
                    : `${getRole(t.min_role_read)}/${getRole(
                        t.min_role_write
                      )}`,
              },
              {
                label: req.__("Delete"),
                key: (r) =>
                  r.name === "users" || r.external
                    ? ""
                    : post_delete_btn(`/table/delete/${r.id}`, req, r.name),
              },
            ],
            rows,
            { hover: true }
          )
        : div(
            h4(req.__("No tables defined")),
            p(req.__("Tables hold collections of similar data"))
          );
    const createCard = div(
      h5(req.__("Create table")),
      a(
        { href: `/table/new`, class: "btn btn-primary mt-1 mr-3" },
        i({ class: "fas fa-plus-square mr-1" }),
        req.__("Create table")
      ),
      a(
        {
          href: `/table/create-from-csv`,
          class: "btn btn-secondary mr-3 mt-1",
        },
        i({ class: "fas fa-upload mr-1" }),
        req.__("Create from CSV upload")
      ),
      !db.isSQLite &&
        a(
          { href: `/table/discover`, class: "btn btn-secondary mt-1" },
          i({ class: "fas fa-map-signs mr-1" }),
          req.__("Discover tables")
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
          title: cardHeaderTabs([
            { label: req.__("Your tables"), href: "/table", active: true },
            {
              label: req.__("Relationship diagram"),
              href: "/table/relationship-diagram",
            },
          ]),
          contents: mainCard + createCard,
        },
      ],
    });
  })
);
/**
 * Download CSV file
 */
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
/**
 * Show list of Constraints for Table (GET Handler)
 */
router.get(
  "/constraints/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });
    if (!table) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
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
              cons,
              { hover: true }
            ),
            link(`/table/add-constraint/${id}`, req.__("Add constraint")),
          ],
        },
      ],
    });
  })
);
/**
 * Constraint Fields Edition Form
 * Choosing fields for adding to contrain
 * @param table_id
 * @param fields
 * @returns {Form}
 */
const constraintForm = (req, table_id, fields) =>
  new Form({
    action: `/table/add-constraint/${table_id}`,
    blurb: req.__(
      "Tick the boxes for the fields that should be jointly unique"
    ),
    fields: fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: "Bool",
    })),
  });
/**
 * Add constraint GET handler
 * ${base_url}/table/add-constraint/:id
 */
router.get(
  "/add-constraint/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });
    if (!table) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
    const fields = await table.getFields();
    const form = constraintForm(req, table.id, fields);
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
/**
 * Add constraint POST handler
 */
router.post(
  "/add-constraint/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });
    if (!table) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
    const fields = await table.getFields();
    const form = constraintForm(req, table.id, fields);
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
/**
 * Rename Table Form
 * Allows to set up new table name
 * @param table_id
 * @param req
 * @returns {Form}
 */
const renameForm = (table_id, req) =>
  new Form({
    action: `/table/rename/${table_id}`,
    labelCols: 3,
    fields: [
      {
        name: "name",
        label: req.__("New table name"),
        type: "String",
      },
    ],
  });
/**
 * Rename Table GET handler
 */
router.get(
  "/rename/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });

    const form = renameForm(table.id, req);
    res.sendWrap(req.__(`Rename table %s`, table.name), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            {
              text: req.__("Rename table"),
            },
          ],
        },
        {
          type: "card",
          title: req.__(`Rename table %s`, table.name),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);
/**
 * Rename Table POST Handler
 */
router.post(
  "/rename/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = await Table.findOne({ id });
    const form = renameForm(table.id, req);

    form.validate(req.body);
    if (form.hasErrors) req.flash("error", req.__("An error occurred"));
    else {
      await table.rename(form.values.name);
    }
    res.redirect(`/table/${table.id}`);
  })
);
/**
 * Delete constraint POST handler
 */
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
/**
 * Import Table Data from CSV POST handler
 */
router.post(
  "/upload_to_table/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = await Table.findOne({ name });
    if (!req.files || !req.files.file) {
      req.flash("error", "Missing file");
      res.redirect(`/table/${table.id}`);
      return;
    }

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
/**
 * Delete All rows from Table
 */
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
/**
 * Call for Recalculate table columns that stored in db (POST Handler)
 */
router.post(
  "/recalc-stored/:name",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = await Table.findOne({ name });
    if (!table) {
      req.flash("error", `Table not found: ${text(name)}`);
      res.redirect(`/table`);
      return;
    }

    recalculate_for_stored(table);

    req.flash("success", req.__("Started recalculating stored fields"));

    res.redirect(`/table/${table.id}`);
  })
);
