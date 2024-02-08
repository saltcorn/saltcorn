/**
 * @category server
 * @module routes/tables
 * @subcategory routes
 */

const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const Table = require("@saltcorn/data/models/table");
const File = require("@saltcorn/data/models/file");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
const Model = require("@saltcorn/data/models/model");
const Trigger = require("@saltcorn/data/models/trigger");
const TagEntry = require("@saltcorn/data/models/tag_entry");
const {
  mkTable,
  renderForm,
  link,
  settingsDropdown,
  post_delete_btn,
  post_btn,
  post_dropdown_item,
} = require("@saltcorn/markup");
const {
  recalculate_for_stored,
  expressionValidator,
} = require("@saltcorn/data/models/expression");
const { isAdmin, error_catcher, setTenant } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const {
  span,
  h4,
  p,
  a,
  div,
  i,
  form,
  label,
  input,
  text,
  script,
  domReady,
  code,
  pre,
  button,
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
const { tablesList, viewsList } = require("./common_lists");
const {
  InvalidConfiguration,
  removeAllWhiteSpace,
  comparingCaseInsensitive,
} = require("@saltcorn/data/utils");
const { EOL } = require("os");

const path = require("path");
const Tag = require("@saltcorn/data/models/tag");
/**
 * @type {object}
 * @const
 * @namespace tablesRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;
/**
 * Show Table Form
 * @param {object} table
 * @param {object} req
 * @returns {Promise<Form>}
 */
const tableForm = async (table, req) => {
  const fields = table.getFields();
  const roleOptions = (await User.get_roles()).map((r) => ({
    value: r.id,
    label: r.role,
  }));
  const ownership_opts = await table.ownership_options();
  const form = new Form({
    action: "/table",
    noSubmitButton: true,
    onChange: "saveAndContinue(this)",
    fields: [
      ...(!table.external && !table.provider_name
        ? [
            {
              label: req.__("Ownership field"),
              name: "ownership_field_id",
              sublabel: req.__(
                "The user referred to in this field will be the owner of the row"
              ),
              input_type: "select",
              options: [
                { value: "", label: req.__("None") },
                ...ownership_opts,
                { value: "_formula", label: req.__("Formula") },
              ],
            },
            {
              name: "ownership_formula",
              label: req.__("Ownership formula"),
              validator: expressionValidator,
              type: "String",
              class: "validate-expression",
              sublabel:
                req.__("User is treated as owner if true. In scope: ") +
                ["user", ...fields.map((f) => f.name)]
                  .map((fn) => code(fn))
                  .join(", "),
              showIf: { ownership_field_id: "_formula" },
            },
            {
              label: req.__("User group"),
              sublabel: req.__(
                "Add relations to this table in dropdown options for ownership field"
              ),
              name: "is_user_group",
              type: "Bool",
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
          "User must have this role or higher to read rows from the table, unless they are the owner"
        ),
        name: "min_role_read",
        input_type: "select",
        options: roleOptions,
        attributes: { asideNext: !table.external && !table.provider_name },
      },
      ...(table.external || table.provider_name
        ? []
        : [
            {
              label: req.__("Minimum role to write"),
              name: "min_role_write",
              input_type: "select",
              sublabel: req.__(
                "User must have this role or higher to edit or create new rows in the table, unless they are the owner"
              ),
              options: roleOptions,
            },
            {
              label: req.__("Version history"),
              sublabel: req.__("Track table data changes over time"),
              name: "versioned",
              type: "Bool",
            },
            ...(table.name === "users"
              ? []
              : [
                  {
                    label: req.__("Sync information"),
                    sublabel: req.__(
                      "Sync information tracks the last modification or deletion timestamp " +
                        "so that the table data can be synchronized with the mobile app"
                    ),
                    name: "has_sync_info",
                    type: "Bool",
                  },
                ]),
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
 * @name get/new
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/new/",
  isAdmin,
  error_catcher(async (req, res) => {
    const table_provider_names = Object.keys(getState().table_providers);
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
                  type: "String",
                  required: true,
                  attributes: { autofocus: true },
                },
                ...(table_provider_names.length
                  ? [
                      {
                        label: req.__("Table provider"),
                        name: "provider_name",
                        input_type: "select",
                        options: [
                          // Due to packages/saltcorn-markup/helpers.ts#L45 (select_options replaces label if o.value === "")
                          { label: req.__("Database table"), value: "-" },
                          ...table_provider_names,
                        ],
                        required: true,
                      },
                    ]
                  : []),
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
 * @param {object[]} tables list of tables
 * @param {object} req HTTP Request
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
 * @name get/discover
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/discover",
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
 * @name post/discover
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/discover",
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
 * @name get/create-from-csv
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/create-from-csv",
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
                  // todo implement file mask filter like , accept: "text/csv"
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
 * @name post/create-from-csv
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
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

const indentString = (str, indent) => `${" ".repeat(indent)}${str}`;

const srcCardinality = (field) => (field.required ? "||" : "|o");

const buildTableMarkup = (table) => {
  const fields = table.getFields();
  const members = fields
    // .filter((f) => !f.reftable_name)
    .map((f) =>
      indentString(`${removeAllWhiteSpace(f.type_name)} ${f.name}`, 6)
    )
    .join(EOL);
  const keys = table
    .getForeignKeys()
    .map((f) =>
      indentString(
        `"${table.name}"${srcCardinality(f)}--|| "${f.reftable_name}" : "${
          f.name
        }"`,
        2
      )
    )
    .join(EOL);
  return `${keys}
  "${table.name}" {${EOL}${members}${EOL}  }`;
};

const buildMermaidMarkup = (tables) => {
  const lines = tables.map((table) => buildTableMarkup(table)).join(EOL);
  return `${indentString("erDiagram", 2)}${EOL}${lines}`;
};

const navigationPanel = () =>
  div(
    { class: "er-navigation-panel" },
    button(
      {
        class: "btn btn-primary er-up",
        onclick: "erHelper.translateY(100)",
      },
      i({ class: "fas fa-chevron-up" })
    ),
    button(
      {
        class: "btn btn-primary er-zoom-in",
        onclick: "erHelper.zoom(0.1)",
      },
      i({ class: "fas fa-search-plus" })
    ),
    button(
      {
        class: "btn btn-primary er-left",
        onclick: "erHelper.translateX(100)",
      },
      i({ class: "fas fa-chevron-left" })
    ),
    button(
      { class: "btn btn-primary er-reset", onclick: "erHelper.reset()" },
      i({ class: "fas fa-sync-alt" })
    ),
    button(
      {
        class: "btn btn-primary er-right",
        onclick: "erHelper.translateX(-100)",
      },
      i({ class: "fas fa-chevron-right" })
    ),
    button(
      {
        class: "btn btn-primary er-down",
        onclick: "erHelper.translateY(-100)",
      },
      i({ class: "fas fa-chevron-down" })
    ),
    button(
      {
        class: "btn btn-primary er-zoom-out",
        onclick: "erHelper.zoom(-0.1)",
      },
      i({ class: "fas fa-search-minus" })
    )
  );

const screenshotPanel = () =>
  div(
    { class: "er-screenshot-panel" },
    button(
      {
        class: "btn btn-primary",
        onclick: "erHelper.takePicture()",
      },
      i({ class: "fas fa-camera" })
    )
  );

/**
 * Show Relational Diagram (get)
 * @name get/relationship-diagram
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/relationship-diagram",
  isAdmin,
  error_catcher(async (req, res) => {
    const tables = await Table.find_with_external({}, { orderBy: "name" });
    res.sendWrap(
      {
        title: req.__("Tables"),
        headers: [
          {
            script: `/static_assets/${db.connectObj.version_tag}/mermaid.min.js`,
          },
          {
            headerTag: `
            <script type="module">
              mermaid.initialize({ 
                startOnLoad: false,
                securityLevel: 'loose',
              });
              await mermaid.run({
                querySelector: ".mermaid",
                postRenderCallback: (id) => {
                  $("#" + id).css("height", "calc(100vh - 250px)");
                  $("#" + id + " > g").each(function(index) {
                    const jThis = $(this);
                    const id = jThis.attr("id");
                    if (id) {
                      const arr = /^entity-(.+)-(\\w+-\\w+-\\w+-\\w+-\\w+$)/.exec(id);
                      if (arr?.length === 3) {
                        const textEnt = $("#text-entity-" + arr[1] + "-" + arr[2]);
                        textEnt.css("cursor", "pointer");
                        textEnt.on("click", function () {
                          if (!erHelper.isTranslating()) {
                            window.open("/table/" + encodeURIComponent(this.innerHTML));
                          }
                        });
                      }
                    }
                  });
                }
              });
            </script>`,
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
            class: "mt-0",
            title: cardHeaderTabs([
              { label: req.__("Your tables"), href: "/table" },
              {
                label: req.__("Relationship diagram"),
                href: "/table/relationship-diagram",
                active: true,
              },
            ]),
            contents: [
              div(
                {
                  id: "erd-wrapper",
                  style: "height: calc(100vh - 250px);",
                  class: "overflow-scroll position-relative",
                },
                screenshotPanel(),
                pre(
                  {
                    class: "mermaid",
                    style: "height: calc(100vh - 250px); color: transparent;",
                  },
                  buildMermaidMarkup(tables)
                ),
                navigationPanel()
              ),
              script({ src: "/relationship_diagram_utils.js" }),
              script(
                domReady(`
                  const erdWrapper = $("#erd-wrapper")[0];
                  erdWrapper.onwheel = erHelper.onWheel;
                  erdWrapper.onmousedown = erHelper.onMouseDown;
                  erdWrapper.onmouseup = erHelper.onMouseUp;
                  window.addEventListener("mousemove", erHelper.onMouseMove);
                `)
              ),
            ],
          },
        ],
      }
    );
  })
);

/**
 * @param {string} col
 * @param {string} lbl
 * @returns {string}
 */
const badge = (col, lbl) => `<span class="badge bg-${col}">${lbl}</span>&nbsp;`;

/**
 * @param {object} f
 * @param {object} req
 * @returns {string}
 */
const typeBadges = (f, req) => {
  let s = "";
  if (f.primary_key) s += badge("warning", req.__("Primary key"));
  if (f.required) s += badge("primary", req.__("Required"));
  if (f.is_unique) s += badge("success", req.__("Unique"));
  if (f.calculated) s += badge("info", req.__("Calculated"));
  if (f.stored) s += badge("warning", req.__("Stored"));
  return s;
};

/**
 * @param {object} f
 * @returns {string}
 */
const attribBadges = (f) => {
  let s = "";
  if (f.attributes) {
    Object.entries(f.attributes).forEach(([k, v]) => {
      if (
        [
          "summary_field",
          "on_delete_cascade",
          "on_delete",
          "unique_error_msg",
        ].includes(k)
      )
        return;
      if (v || v === 0) s += badge("secondary", k);
    });
  }
  return s;
};

/**
 * Table Constructor (GET Handler)
 * @name get/:idorname
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/:idorname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { idorname } = req.params;
    let id = parseInt(idorname);
    let table;
    if (id) [table] = await Table.find({ id });
    else {
      [table] = await Table.find({ name: idorname });
    }

    if (!table) {
      req.flash("error", req.__(`Table not found`));
      res.redirect(`/table`);
      return;
    }
    const nrows = await table.countRows({}, { forUser: req.user });
    const fields = table.getFields();
    const { child_relations } = await table.get_child_relations();
    const inbound_refs = [
      ...new Set(child_relations.map(({ table }) => table.name)),
    ];
    const triggers = table.id ? Trigger.find({ table_id: table.id }) : [];
    triggers.sort(comparingCaseInsensitive("name"));
    let fieldCard;
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
                : (r.type && r.type.name) ||
                  r.type ||
                  r.typename +
                    span({ class: "badge bg-danger ms-1" }, "Unknown type"),
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
        triggers.length
          ? req.__("Table triggers: ") +
            triggers
              .map((t) =>
                link(
                  `/actions/configure/${
                    t.id
                  }?on_done_redirect=${encodeURIComponent(
                    `table/${table.name}`
                  )}`,
                  t.name
                )
              )
              .join(", ") +
            "<br>"
          : "",
        !table.external &&
          !table.provider_name &&
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
      const views = await View.find(
        table.id ? { table_id: table.id } : { exttable_name: table.name }
      );
      var viewCardContents;
      if (views.length > 0) {
        viewCardContents = await viewsList(views, req, {
          on_done_redirect: encodeURIComponent(`table/${table.name}`),
          notable: true,
        });
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
              href: `/viewedit/new?table=${encodeURIComponent(
                table.name
              )}&on_done_redirect=${encodeURIComponent(`table/${table.name}`)}`,
              class: "btn btn-primary",
            },
            req.__("Create view")
          ),
      };
    }
    const models = await Model.find({ table_id: table.id });
    const modelCard = div(
      mkTable(
        [
          {
            label: req.__("Name"),
            key: (r) => link(`/models/show/${r.id}`, r.name),
          },
          { label: req.__("Pattern"), key: "modelpattern" },
          {
            label: req.__("Delete"),
            key: (r) =>
              post_delete_btn(
                `/models/delete/${encodeURIComponent(r.id)}`,
                req
              ),
          },
        ],
        models
      ),
      a(
        { href: `/models/new/${table.id}`, class: "btn btn-primary" },
        i({ class: "fas fa-plus-square me-1" }),
        req.__("Create model")
      )
    );

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
      table.provider_name &&
        div(
          { class: "mx-auto" },
          a(
            { href: `/table/provider-cfg/${table.id}` },
            i({ class: "fas fa-2x fa-tools" }),
            "<br/>",
            req.__("Configure provider")
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
        !table.provider_name &&
        div(
          { class: "mx-auto" },
          form(
            {
              method: "post",
              action: `/table/upload_to_table/${table.name}`,
              encType: "multipart/form-data",
              acceptCharset: "UTF-8",
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
      !table.external &&
        !table.provider_name &&
        div(
          { class: "mx-auto" },
          a(
            { href: `/table/constraints/${table.id}` },
            i({ class: "fas fa-2x fa-tasks" }),
            "<br/>",
            req.__("Constraints") +
              (table.constraints?.length
                ? ` (${table.constraints.length})`
                : "")
          )
        ),

      // only if table is not external
      !table.external &&
        !table.provider_name &&
        div(
          { class: "mx-auto" },
          settingsDropdown(`dataMenuButton`, [
            // rename table doesnt supported for sqlite
            !db.isSQLite &&
              table.name !== "users" &&
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
            table.name !== "users" &&
              post_dropdown_item(
                `/table/forget-table/${table.id}`,
                '<i class="fas fa-recycle"></i>&nbsp;' + req.__("Forget table"),
                req,
                true
              ),
          ])
        )
    );
    // add table form
    if (table.ownership_formula && !table.ownership_field_id)
      table.ownership_field_id = "_formula";
    const tblForm = await tableForm(table, req);
    res.sendWrap(req.__(`%s table`, table.name), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            {
              text: span(
                { class: "fw-bold text-body" },
                table.name,
                table.provider_name && ` (${table.provider_name} provider)`
              ),
            },
          ],
        },
        {
          type: "card",
          class: "mt-0",
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
          titleAjaxIndicator: true,
          contents: renderForm(tblForm, req.csrfToken()),
        },
        ...(Model.has_templates
          ? [
              {
                type: "card",
                title: req.__("Models"),
                contents: modelCard,
              },
            ]
          : []),
      ],
    });
  })
);

/**
 * @name post
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/",
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
      } else if (rest.provider_name && rest.provider_name !== "-") {
        const table = await Table.create(name, rest);
        res.redirect(`/table/provider-cfg/${table.id}`);
      } else {
        delete rest.provider_name;
        const table = await Table.create(name, rest);
        req.flash("success", req.__(`Table %s created`, name));
        res.redirect(`/table/${table.id}`);
      }
    } else if (v.external) {
      // todo check that works after where change
      // todo findOne can be have parameter for external table here
      //we can only save min role
      const table = Table.findOne({ name: v.name });
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
        if (!req.xhr) {
          req.flash("success", req.__("Table saved"));
          res.redirect(`/table/${table.name}`);
        } else res.json({ success: "ok" });
      }
    } else {
      const { id, _csrf, ...rest } = v;
      const table = Table.findOne({ id: parseInt(id) });
      const old_versioned = table.versioned;
      const old_has_sync_info = table.has_sync_info;
      let hasError = false;
      let notify = "";
      if (!rest.versioned) rest.versioned = false;
      if (!rest.has_sync_info) rest.has_sync_info = false;
      if (rest.ownership_field_id === "_formula") {
        rest.ownership_field_id = null;
        const fmlValidRes = expressionValidator(rest.ownership_formula);
        if (typeof fmlValidRes === "string") {
          notify = req.__(`Invalid ownership formula: %s`, fmlValidRes);
          hasError = true;
        }
      } else if (
        typeof rest.ownership_field_id === "string" &&
        rest.ownership_field_id.startsWith("Fml:")
      ) {
        rest.ownership_formula = rest.ownership_field_id.replace("Fml:", "");
        rest.ownership_field_id = null;
      } else rest.ownership_formula = null;
      await table.update(rest);

      if (!req.xhr) {
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
        else if (!hasError) req.flash("success", req.__("Table saved"));
        res.redirect(`/table/${id}`);
      } else res.json({ success: "ok", notify });
    }
  })
);

/**
 * Delete Table Route Handler definition
 * /delete:/id, where id is table id in _sc_tables
 * @name post/delete/:id
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/delete/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const t = Table.findOne({ id });
    if (!t) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
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
router.post(
  "/forget-table/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const t = Table.findOne({ id });
    if (!t) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
    if (t.name === "users") {
      req.flash("error", req.__(`Cannot delete users table`));
      res.redirect(`/table`);
      return;
    }
    try {
      await t.delete(true);
      req.flash(
        "success",
        req.__(`Table %s forgotten. You can now discover it.`, t.name)
      );
      res.redirect(`/table`);
    } catch (err) {
      req.flash("error", err.message);
      res.redirect(`/table`);
    }
  })
);

/**
 * List Views of Tables (GET Handler)
 * @name get
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const tblq = {};
    let filterOnTag;
    if (req.query._tag) {
      const tagEntries = await TagEntry.find({
        tag_id: +req.query._tag,
        not: { table_id: null },
      });
      tblq.id = { in: tagEntries.map((te) => te.table_id).filter(Boolean) };
      filterOnTag = await Tag.findOne({ id: +req.query._tag });
    }
    const rows = await Table.find_with_external(tblq, {
      orderBy: "name",
      nocase: true,
    });
    const roles = await User.get_roles();
    const getRole = (rid) => roles.find((r) => r.id === rid).role;
    const mainCard = await tablesList(rows, req, { filterOnTag });
    const createCard = div(
      a(
        { href: `/table/new`, class: "btn btn-primary mt-1 me-3" },
        i({ class: "fas fa-plus-square me-1" }),
        req.__("Create table")
      ),
      a(
        {
          href: `/table/create-from-csv`,
          class: "btn btn-secondary me-3 mt-1",
        },
        i({ class: "fas fa-upload me-1" }),
        req.__("Create from CSV upload")
      ),
      !db.isSQLite &&
        a(
          {
            href: `/table/discover`,
            class: "btn btn-secondary mt-1",
            title: req.__(
              "Discover tables that are already in the Database, but not known to Saltcorn"
            ),
          },
          i({ class: "fas fa-map-signs me-1" }),

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
          class: "mt-0",
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
 * @name get/download/:name
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/download/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = Table.findOne({ name });
    const rows = await table.getRows({}, { orderBy: "id", forUser: req.user });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.csv"`);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Pragma", "no-cache");
    const columns = table.fields.sort((a, b) => a.id - b.id).map((f) => f.name);
    for (const field of table.fields) {
      if (field.type?.name === "JSON" && field.attributes?.hasSchema) {
        (field.attributes?.schema || []).forEach((s) => {
          columns.push(`${field.name}.${s.key}`);
        });
        columns.splice(columns.indexOf(field.name), 1);
        for (const row of rows) {
          Object.keys(row[field.name] || {}).forEach((k) => {
            row[`${field.name}.${k}`] = row[field.name][k];
          });
          delete row[field.name];
        }
      }
    }
    stringify(rows, {
      header: true,
      columns,
      cast: {
        date: (value) => value.toISOString(),
        boolean: (v) => (v ? "true" : "false"),
      },
    }).pipe(res);
  })
);

/**
 * Show list of Constraints for Table (GET Handler)
 * @name get/constraints/:id
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/constraints/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = Table.findOne({ id });
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
                  label: req.__("What"),
                  key: (r) =>
                    r.type === "Unique"
                      ? r.configuration.fields.join(", ")
                      : r.type === "Index"
                      ? r.configuration.field
                      : r.type === "Formula"
                      ? r.configuration.formula
                      : "",
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
            req.__("Add constraint: "),
            link(`/table/add-constraint/${id}/Unique`, req.__("Unique")),
            " | ",
            link(`/table/add-constraint/${id}/Formula`, req.__("Formula")),
            " | ",
            link(`/table/add-constraint/${id}/Index`, req.__("Index")),
            a(
              {
                href: `javascript:ajax_modal('/admin/help/Table%20constraints?table=${table.name}')`,
              },
              i({ class: "fas fa-question-circle ms-1" })
            ),
          ],
        },
      ],
    });
  })
);
/**
 * Constraint Fields Edition Form
 * Choosing fields for adding to contrain
 * @param req
 * @param {string} table_id
 * @param {object[]} fields
 * @returns {Form}
 */
const constraintForm = (req, table, fields, type) => {
  switch (type) {
    case "Formula":
      return new Form({
        action: `/table/add-constraint/${table.id}/${type}`,

        fields: [
          {
            name: "formula",
            label: req.__("Constraint formula"),
            validator: expressionValidator,
            type: "String",
            class: "validate-expression",
            help: {
              topic: "Table formula constraint",
              context: { table: table.name },
            },
            sublabel:
              req.__(
                "Formula must evaluate to true for valid rows. In scope: "
              ) +
              fields
                .map((f) => f.name)
                .map((fn) => code(fn))
                .join(", "),
          },
          {
            name: "errormsg",
            label: "Error message",
            sublabel: "Shown to the user if formula is false",
            type: "String",
          },
        ],
      });
    case "Unique":
      return new Form({
        action: `/table/add-constraint/${table.id}/${type}`,
        blurb: req.__(
          "Tick the boxes for the fields that should be jointly unique"
        ),
        fields: [
          ...fields.map((f) => ({
            name: f.name,
            label: f.label,
            type: "Bool",
          })),
          {
            name: "errormsg",
            label: "Error message",
            sublabel: "Shown to the user if joint uniqueness is violated",
            type: "String",
          },
        ],
      });
    case "Index":
      return new Form({
        action: `/table/add-constraint/${table.id}/${type}`,
        blurb: req.__(
          "Choose the field to be indexed. This make searching the table faster."
        ),
        fields: [
          {
            type: "String",
            name: "field",
            label: "Field",
            required: true,
            attributes: {
              options: fields.map((f) => ({ label: f.label, name: f.name })),
            },
          },
        ],
      });
  }
};

/**
 * Add constraint GET handler
 * ${base_url}/table/add-constraint/:id
 * @name get/add-constraint/:id
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/add-constraint/:id/:type",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id, type } = req.params;
    const table = Table.findOne({ id });
    if (!table) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
    const fields = table.getFields();
    const form = constraintForm(req, table, fields, type);
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
          title: req.__(`Add %s constraint to %s`, type, table.name),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);

/**
 * Add constraint POST handler
 * @name post/add-constraint/:id
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/add-constraint/:id/:type",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id, type } = req.params;
    const table = Table.findOne({ id });
    if (!table) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
    const fields = table.getFields();
    const form = constraintForm(req, table, fields, type);
    form.validate(req.body);
    if (form.hasErrors) req.flash("error", req.__("An error occurred"));
    else {
      let configuration = {};
      if (type === "Unique") {
        configuration.fields = fields
          .map((f) => f.name)
          .filter((f) => form.values[f]);
        configuration.errormsg = form.values.errormsg;
      } else configuration = form.values;
      await TableConstraint.create({
        table_id: table.id,
        type,
        configuration,
      });
    }
    res.redirect(`/table/constraints/${table.id}`);
  })
);
/**
 * Rename Table Form
 * Allows to set up new table name
 * @param {string} table_id
 * @param {object} req
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
 * @name get/rename/:id
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.get(
  "/rename/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = Table.findOne({ id });

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
 * @name post/rename/:id
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/rename/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const table = Table.findOne({ id });
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
 * @name post/delete-constraint/:id",
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/delete-constraint/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const cons = await TableConstraint.findOne({ id });
    await cons.delete();
    res.redirect(`/table/constraints/${cons.table_id}`);
  })
);

const previewCSV = async ({ newPath, table, req, res, full }) => {
  let parse_res;
  try {
    parse_res = await table.import_csv_file(newPath, {
      recalc_stored: true,
      no_table_write: true,
    });
  } catch (e) {
    parse_res = { error: e.message };
  }
  if (parse_res.error) {
    if (parse_res.error) req.flash("error", parse_res.error);
    await fs.unlink(newPath);
    res.redirect(`/table/${table.id}`);
  } else {
    const rows = parse_res.rows || [];
    res.sendWrap(req.__(`Import table %s`, table.name), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            {
              text: req.__("Import CSV"),
            },
          ],
        },
        {
          type: "card",
          title: req.__(`Import CSV`),
          contents: div(
            {
              "data-csv-filename": path.basename(newPath),
            },
            p(parse_res.success),
            post_btn(
              `/files/delete/${path.basename(newPath)}?redirect=/table/${
                table.id
              }}`,
              "Cancel",
              req.csrfToken(),
              {
                btnClass: "btn-danger",
                formClass: "d-inline me-2",
                icon: "fa fa-times",
              }
            ),
            post_btn(
              `/table/finish_upload_to_table/${table.name}/${path.basename(
                newPath
              )}`,
              "Proceed",
              req.csrfToken(),
              { icon: "fa fa-check", formClass: "d-inline" }
            )
          ),
        },
        {
          type: "card",
          title: req.__(`Preview`),
          contents: div(
            mkTable(
              table.fields.map((f) => ({
                label: f.name,
                key:
                  f.type?.name === "JSON"
                    ? (r) => JSON.stringify(r[f.name])
                    : f.name,
              })),
              full ? rows : rows.slice(0, 10)
            ),
            !full &&
              rows.length > 10 &&
              a(
                {
                  href: `/table/preview_full_csv_file/${
                    table.name
                  }/${path.basename(newPath)}`,
                },
                `See all ${rows.length} rows`
              )
          ),
        },
        ...(parse_res.details
          ? [
              {
                type: "card",
                title: req.__(`Details`),
                contents: pre(parse_res.details),
              },
            ]
          : []),
      ],
    });
  }
};

/**
 * Import Table Data from CSV POST handler
 * @name post/upload_to_table/:name,
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/upload_to_table/:name",
  setTenant, // TODO why is this needed?????
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = Table.findOne({ name });
    if (!req.files || !req.files.file) {
      req.flash("error", "Missing file");
      res.redirect(`/table/${table.id}`);
      return;
    }

    const newPath = File.get_new_path();
    await req.files.file.mv(newPath);
    //console.log(req.files.file.data)
    await previewCSV({ newPath, table, res, req });
  })
);

router.get(
  "/preview_full_csv_file/:name/:filename",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name, filename } = req.params;
    const table = Table.findOne({ name });
    const f = await File.findOne(filename);
    await previewCSV({ newPath: f.location, table, res, req, full: true });
  })
);

router.post(
  "/finish_upload_to_table/:name/:filename",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name, filename } = req.params;
    const table = Table.findOne({ name });
    const f = await File.findOne(filename);

    try {
      const parse_res = await table.import_csv_file(f.location, {
        recalc_stored: true,
      });
      if (parse_res.error) req.flash("error", parse_res.error);
      else req.flash("success", parse_res.success);
    } catch (e) {
      req.flash("error", e.message);
    }
    await fs.unlink(f.location);
    res.redirect(`/table/${table.id}`);
  })
);

/**
 * Delete All rows from Table
 * @name post/delete-all-rows/:name,
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/delete-all-rows/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = Table.findOne({ name });

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
 * @name post/recalc-stored/:name,
 * @function
 * @memberof module:routes/tables~tablesRouter
 * @function
 */
router.post(
  "/recalc-stored/:name",
  isAdmin,
  error_catcher(async (req, res) => {
    const { name } = req.params;
    const table = Table.findOne({ name });
    if (!table) {
      req.flash("error", `Table not found: ${text(name)}`);
      res.redirect(`/table`);
      return;
    }
    //intentionally omit await
    recalculate_for_stored(table);

    req.flash("success", req.__("Started recalculating stored fields"));

    res.redirect(`/table/${table.id}`);
  })
);

const respondWorkflow = (table, wf, wfres, req, res) => {
  const wrap = (contents, noCard, previewURL) => ({
    above: [
      {
        type: "breadcrumbs",
        crumbs: [
          { text: req.__("Tables"), href: "/table" },
          { href: `/table/${table.id || table.name}`, text: table.name },
          { text: req.__("Configuration") },
        ],
      },
      {
        type: noCard ? "container" : "card",
        class: !noCard && "mt-0",
        title: wfres.title,
        titleAjaxIndicator: true,
        contents,
      },
    ],
  });
  if (wfres.flash) req.flash(wfres.flash[0], wfres.flash[1]);
  if (wfres.renderForm)
    res.sendWrap(
      {
        title: req.__(`%s configuration`, table.name),
        headers: [
          {
            script: `/static_assets/${db.connectObj.version_tag}/jquery-menu-editor.min.js`,
          },
          {
            script: `/static_assets/${db.connectObj.version_tag}/iconset-fontawesome5-3-1.min.js`,
          },
          {
            script: `/static_assets/${db.connectObj.version_tag}/bootstrap-iconpicker.js`,
          },
          {
            css: `/static_assets/${db.connectObj.version_tag}/bootstrap-iconpicker.min.css`,
          },
        ],
      },
      wrap(
        renderForm(wfres.renderForm, req.csrfToken()),
        false,
        wfres.previewURL
      )
    );
  else res.redirect(wfres.redirect);
};

const get_provider_workflow = (table, req) => {
  const provider = getState().table_providers[table.provider_name];
  if (!provider) {
    throw new InvalidConfiguration(
      `Provider not found for rable ${table.name}: table.provider_name`
    );
  }
  const workflow = provider.configuration_workflow(req);
  workflow.action = `/table/provider-cfg/${table.id}`;
  const oldOnDone = workflow.onDone || ((c) => c);
  workflow.onDone = async (ctx) => {
    const { table_id, ...configuration } = await oldOnDone(ctx);
    await table.update({ provider_cfg: configuration });

    return {
      redirect: `/table/${table.id}`,
      flash: ["success", `Table ${table.name || ""} saved`],
    };
  };
  return workflow;
};

router.get(
  "/provider-cfg/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const { step } = req.query;

    const table = Table.findOne({ id });
    if (!table) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
    const workflow = get_provider_workflow(table, req);
    const wfres = await workflow.run(
      {
        ...(table.provider_cfg || {}),
        table_id: table.id,
        ...(step ? { stepName: step } : {}),
      },
      req
    );
    respondWorkflow(table, workflow, wfres, req, res);
  })
);

router.post(
  "/provider-cfg/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const { step } = req.query;

    const table = Table.findOne({ id });
    if (!table) {
      req.flash("error", `Table not found`);
      res.redirect(`/table`);
      return;
    }
    const workflow = get_provider_workflow(table, req);
    const wfres = await workflow.run(req.body, req);
    respondWorkflow(table, workflow, wfres, req, res);
  })
);
