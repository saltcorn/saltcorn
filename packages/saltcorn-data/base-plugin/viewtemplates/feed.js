/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/feed
 * @subcategory base-plugin
 */
const Field = require("../../models/field");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const {
  text,
  div,
  h4,
  hr,
  a,
  h3,
  button,
  code,
  h2,
} = require("@saltcorn/markup/tags");
const { pagination } = require("@saltcorn/markup/helpers");
const { renderForm, tabs, link } = require("@saltcorn/markup");
const { mkTable } = require("@saltcorn/markup");
const pluralize = require("pluralize");
const {
  link_view,
  stateToQueryString,
  stateFieldsToWhere,
  stateFieldsToQuery,
  readState,
} = require("../../plugin-helper");
const {
  InvalidConfiguration,
  isNode,
  isWeb,
  mergeConnectedObjects,
  hashState,
} = require("../../utils");
const { getState } = require("../../db/state");
const {
  jsexprToWhere,
  eval_expression,
  add_free_variables_to_joinfields,
  freeVariables,
} = require("../../models/expression");
const {
  extractFromLayout,
  extractViewToCreate,
} = require("../../diagram/node_extract_utils");

/**
 * @param {object} req
 * @returns {Workflow}
 */
const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Views"),
        form: async (context) => {
          const table = Table.findOne(context.table_id);
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewtemplate, viewrow }) =>
              viewtemplate.runMany &&
              viewrow.name !== context.viewname &&
              state_fields.some((sf) => sf.name === "id")
          );
          const create_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.every((sf) => !sf.required)
          );
          const show_view_opts = show_views.map((v) => v.select_option);
          const create_view_opts = create_views.map((v) => v.select_option);
          return new Form({
            fields: [
              {
                name: "show_view",
                label: req.__("Single item view"),
                type: "String",
                sublabel:
                  req.__("The underlying individual view of each table row") +
                  ". " +
                  a(
                    {
                      "data-dyn-href": `\`/viewedit/config/\${show_view}\``,
                      target: "_blank",
                    },
                    req.__("Configure")
                  ),
                required: true,
                attributes: {
                  options: show_view_opts,
                },
              },
              {
                name: "empty_view",
                label: req.__("Empty view"),
                type: "String",
                sublabel: req.__(
                  "A view that will be shown only if there are no tables rows to show"
                ),
                attributes: {
                  options: create_view_opts,
                },
              },
              {
                input_type: "section_header",
                label: "Creating a new view",
              },
              {
                name: "view_to_create",
                label: req.__("Use view to create"),
                sublabel: req.__(
                  "If user has write permission.  Leave blank to have no link to create a new item"
                ),
                type: "String",
                attributes: {
                  options: create_view_opts,
                },
              },
              {
                name: "create_view_display",
                label: req.__("Display create view as"),
                type: "String",
                required: true,
                attributes: {
                  options: "Link,Embedded,Popup",
                },
                showIf: { view_to_create: create_view_opts.map((o) => o.name) },
              },
              {
                name: "create_view_showif",
                label: req.__("Show if formula"),
                type: "String",
                sublabel: req.__(
                  "Show link or embed if true, don't show if false. Based on state variables from URL query string and <code>user</code>. For the full state use <code>row</code>. Example: <code>!!row.createlink</code> to show link if and only if state has <code>createlink</code>."
                ),
                showIf: { view_to_create: create_view_opts.map((o) => o.name) },
              },
              {
                name: "create_view_label",
                label: req.__("Label for create"),
                sublabel: req.__(
                  "Label in link or button to create. Leave blank for a default label"
                ),
                type: "String",
                attributes: { asideNext: true },
                showIf: {
                  create_view_display: ["Link", "Popup"],
                  view_to_create: create_view_opts.map((o) => o.name),
                },
              },

              {
                name: "create_view_location",
                label: req.__("Location"),
                sublabel: req.__("Location of link to create new row"),
                //required: true,
                attributes: {
                  options: [
                    "Bottom left",
                    "Bottom right",
                    "Top left",
                    "Top right",
                  ],
                },
                type: "String",
                showIf: {
                  create_view_display: ["Link", "Popup"],
                  view_to_create: create_view_opts.map((o) => o.name),
                },
              },
              {
                name: "create_link_style",
                label: req.__("Link Style"),
                type: "String",
                required: true,
                attributes: {
                  asideNext: true,
                  options: [
                    { name: "", label: "Link" },
                    { name: "btn btn-primary", label: "Primary button" },
                    { name: "btn btn-secondary", label: "Secondary button" },
                    { name: "btn btn-success", label: "Success button" },
                    { name: "btn btn-danger", label: "Danger button" },
                    {
                      name: "btn btn-outline-primary",
                      label: "Primary outline button",
                    },
                    {
                      name: "btn btn-outline-secondary",
                      label: "Secondary outline button",
                    },
                  ],
                },

                showIf: {
                  create_view_display: ["Link", "Popup"],
                  view_to_create: create_view_opts.map((o) => o.name),
                },
              },
              {
                name: "create_link_size",
                label: req.__("Link size"),
                type: "String",
                required: true,
                attributes: {
                  options: [
                    { name: "", label: "Standard" },
                    { name: "btn-lg", label: "Large" },
                    { name: "btn-sm", label: "Small" },
                    { name: "btn-sm btn-xs", label: "X-Small" },
                    { name: "btn-block", label: "Block" },
                    { name: "btn-block btn-lg", label: "Large block" },
                  ],
                },
                showIf: { create_view_display: ["Link", "Popup"] },
              },

              ...(table.ownership_field_id
                ? [
                    {
                      name: "always_create_view",
                      label: req.__("Always show create view"),
                      sublabel: req.__(
                        "If off, only show create view if the query state is about the current user"
                      ),
                      type: "Bool",
                      showIf: {
                        view_to_create: create_view_opts.map((o) => o.name),
                      },
                    },
                  ]
                : []),
            ],
          });
        },
      },
      {
        name: req.__("Order and layout"),
        form: async (context) => {
          const table = Table.findOne({ id: context.table_id });
          const fields = table.getFields();
          const { child_field_list, child_relations } =
            await table.get_child_relations();
          return new Form({
            fields: [
              {
                name: "order_field",
                label: req.__("Order by"),
                type: "String",
                required: true,
                attributes: {
                  asideNext: true,
                  options: fields.map((f) => f.name),
                },
              },
              {
                name: "descending",
                label: req.__("Descending"),
                type: "Bool",
                required: true,
              },
              {
                name: "groupby",
                label: "Group by",
                type: "String",
                sublabel: "Formula for the group headings",
                class: "validate-expression",
              },
              {
                name: "rows_per_page",
                label: req.__("Items per page"),
                type: "Integer",
                attributes: {
                  min: 1,
                },
                required: true,
                default: 20,
              },
              {
                name: "view_decoration",
                label: req.__("View decoration"),
                type: "String",
                attributes: { options: ["None", "Card", "Accordion"] },
                required: true,
              },
              /*{
                name: "in_card",
                label: req.__("Each in card?"),
                type: "Bool",
                required: true,
              },*/
              {
                name: "masonry_columns",
                label: req.__("Masonry columns"),
                type: "Bool",
                showIf: { view_decoration: "Card" },
                required: true,
              },
              {
                name: "title_formula",
                label: req.__("Title formula"),
                class: "validate-expression",
                type: "String",
                showIf: { view_decoration: ["Card", "Accordion"] },
              },
              {
                name: "initial_open_accordions",
                label: req.__("Initially open"),
                type: "String",
                fieldview: "radio_group",
                attributes: { options: ["None", "All", "First"], inline: true },
                required: true,
                showIf: { view_decoration: "Accordion" },
              },
              {
                name: "hide_pagination",
                label: req.__("Hide pagination"),
                type: "Bool",
                required: true,
              },
              {
                input_type: "section_header",
                label: "Row restrictions",
              },
              {
                name: "include_fml",
                label: req.__("Row inclusion formula"),
                class: "validate-expression",
                sublabel:
                  req.__("Only include rows where this formula is true. ") +
                  req.__("In scope:") +
                  " " +
                  [
                    ...fields.map((f) => f.name),
                    "user",
                    "year",
                    "month",
                    "day",
                    "today()",
                  ]
                    .map((s) => code(s))
                    .join(", "),
                type: "String",
              },
              {
                name: "exclusion_relation",
                label: req.__("Exclusion relations"),
                sublabel: req.__(
                  "Do not include row if this relation has a match"
                ),
                type: "String",
                required: false,
                attributes: { options: child_field_list },
              },
              {
                name: "exclusion_where",
                label: req.__("Exclusion where"),
                class: "validate-expression",
                type: "String",
                showIf: { exclusion_relation: child_field_list },
              },
              {
                input_type: "section_header",
                label: "Number of columns (1-4) by screen width",
              },
              {
                name: "cols_sm",
                label: req.__("Small"),
                type: "Integer",
                attributes: {
                  asideNext: true,
                  min: 1,
                  max: 4,
                },
                required: true,
                default: 1,
              },
              {
                name: "cols_md",
                label: req.__("Medium"),
                type: "Integer",
                attributes: {
                  min: 1,
                  max: 4,
                },
                required: true,
                default: 1,
              },
              {
                name: "cols_lg",
                label: req.__("Large"),
                type: "Integer",
                attributes: {
                  asideNext: true,
                  min: 1,
                  max: 4,
                },
                required: true,
                default: 1,
              },
              {
                name: "cols_xl",
                label: req.__("Extra-large"),
                type: "Integer",
                attributes: {
                  min: 1,
                  max: 4,
                },
                required: true,
                default: 1,
              },
            ],
          });
        },
      },
    ],
  });

/**
 * @param {number} table_id
 * @param {*} viewname
 * @param {object} opts
 * @param {*} opts.show_view
 * @returns {Promise<Field>}
 */
const get_state_fields = async (table_id, viewname, { show_view }) => {
  const table = Table.findOne(table_id);
  const table_fields = table.fields;
  return table_fields
    .filter((f) => !f.primary_key)
    .map((f) => {
      const sf = new Field(f);
      sf.required = false;
      return sf;
    });
};

/**
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} opts
 * @param {string} opts.show_view
 * @param {name} opts.order_field
 * @param {boolean} opts.descending
 * @param {string} [opts.view_to_create]
 * @param {string} opts.create_view_display
 * @param {boolean} opts.in_card
 * @param {string} opts.masonry_columns
 * @param {number} [opts.rows_per_page = 20]
 * @param {boolean} opts.hide_pagination
 * @param {string} [opts.create_view_label]
 * @param {string} [opts.create_view_location]
 * @param {boolean} opts.always_create_view
 * @param {*} opts.cols
 * @param {object} state
 * @param {*} extraArgs
 * @returns {Promise<div>}
 */
const run = async (
  table_id,
  viewname,
  {
    show_view,
    order_field,
    descending,
    view_to_create,
    create_view_display,
    in_card, //legacy
    view_decoration,
    initial_open_accordions = "None",
    title_formula,
    masonry_columns,
    rows_per_page = 20,
    hide_pagination,
    create_view_label,
    create_view_location,
    create_link_style,
    create_link_size,
    create_view_showif,
    always_create_view,
    include_fml,
    exclusion_relation,
    exclusion_where,
    empty_view,
    groupby,
    ...cols
  },
  state,
  extraArgs,
  { countRowsQuery }
) => {
  const table = Table.findOne({ id: table_id });
  const fields = table.getFields();
  readState(state, fields);
  const stateHash = hashState(state, show_view);
  const appState = getState();
  const locale = extraArgs.req.getLocale();
  const __ = isNode()
    ? (s) => appState.i18n.__({ phrase: s, locale }) || s
    : (s) => s;
  if (!show_view)
    throw new InvalidConfiguration(
      `View ${viewname} incorrectly configured: Single item view not specified`
    );
  const sview = await View.findOne({ name: show_view });
  if (!sview)
    throw new InvalidConfiguration(
      `View ${viewname} incorrectly configured: cannot find view ${show_view}`
    );
  const q = await stateFieldsToQuery({ state, fields });
  let qextra = {};
  if (!q.orderBy) {
    qextra.orderBy = order_field;
    if (descending) qextra.orderDesc = true;
  }
  qextra.limit = q.limit || rows_per_page;
  const current_page = parseInt(state[`_${stateHash}_page`]) || 1;
  const user_id =
    extraArgs && extraArgs.req.user ? extraArgs.req.user.id : null;
  if (include_fml)
    qextra.where = jsexprToWhere(
      include_fml,
      {
        ...state,
        user_id,
        user: extraArgs?.req?.user,
      },
      table.fields
    );
  if (exclusion_relation) {
    const [reltable, relfld] = exclusion_relation.split(".");
    const relTable = Table.findOne({ name: reltable });
    const relWhere = exclusion_where
      ? jsexprToWhere(
          exclusion_where,
          {
            user_id,
            user: extraArgs?.req?.user,
          },
          relTable.fields
        )
      : {};
    const relRows = await relTable.getRows(relWhere);
    if (!qextra.where) qextra.where = {};
    qextra.where.id = { not: { in: relRows.map((r) => r[relfld]) } };
  }
  qextra.joinFields = {};
  add_free_variables_to_joinfields(
    freeVariables(title_formula),
    qextra.joinFields,
    fields
  );
  add_free_variables_to_joinfields(
    freeVariables(groupby || ""),
    qextra.joinFields,
    fields
  );
  const sresp = await sview.runMany(state, {
    ...extraArgs,
    ...qextra,
  });
  let paginate = "";

  if (sresp.length === 0 && empty_view) {
    const emptyView = await View.findOne({ name: empty_view });
    if (!emptyView)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find empty view ${empty_view}`
      );
    return await emptyView.run(state, extraArgs);
  }

  if (!hide_pagination && (sresp.length === qextra.limit || current_page > 1)) {
    const nrows = await countRowsQuery(state);
    if (nrows > qextra.limit || current_page > 1) {
      paginate = pagination({
        current_page,
        pages: Math.ceil(nrows / qextra.limit),
        get_page_link: (n) =>
          `gopage(${n}, ${qextra.limit}, '${stateHash}', {}, this)`,
      });
    }
  }
  const [vpos, hpos] = (create_view_location || "Bottom left").split(" ");
  const istop = vpos === "Top";
  const isright = hpos === "right";
  const role =
    extraArgs && extraArgs.req && extraArgs.req.user
      ? extraArgs.req.user.role_id
      : 100;
  var create_link = "";

  const about_user = fields.some(
    (f) =>
      f.reftable_name === "users" && state[f.name] && state[f.name] === user_id
  );
  const create_link_showif_pass = create_view_showif
    ? eval_expression(create_view_showif, state, extraArgs.req.user)
    : undefined;
  if (
    create_link_showif_pass !== false &&
    view_to_create &&
    (create_link_showif_pass ||
      role <= table.min_role_write ||
      (table.ownership_field_id && (about_user || always_create_view)))
  ) {
    if (create_view_display === "Embedded") {
      const create_view = await View.findOne({ name: view_to_create });
      if (!create_view)
        throw new InvalidConfiguration(
          `View ${viewname} incorrectly configured: cannot find embedded view to create ${view_to_create}`
        );
      create_link = await create_view.run(state, extraArgs);
    } else {
      const target = `/view/${encodeURIComponent(
        view_to_create
      )}${stateToQueryString(state)}`;
      const hrefVal = isWeb(extraArgs.req)
        ? target
        : `javascript:execLink('${target}');`;
      create_link = link_view(
        hrefVal,
        __(create_view_label) || `Add ${pluralize(table.name, 1)}`,
        create_view_display === "Popup" ? { reload_view: viewname } : false,
        create_link_style,
        create_link_size
      );
    }
  }
  const create_link_div = isright
    ? div({ class: "float-end" }, create_link)
    : create_link;

  const setCols = (sz) => `col-${sz}-${Math.round(12 / cols[`cols_${sz}`])}`;

  const showRowInner = (r, ix) =>
    (!view_decoration && in_card) || view_decoration === "Card"
      ? div(
          { class: `card shadow ${masonry_columns ? "mt-2" : "mt-4 h-100"}` },
          title_formula
            ? div(
                { class: "card-header" },
                eval_expression(title_formula, r.row, extraArgs.req.user)
              )
            : undefined,
          div({ class: "card-body" }, r.html)
        )
      : view_decoration === "Accordion"
      ? div(
          { class: "accordion-item" },
          h2(
            { class: "accordion-header", id: `a${stateHash}head${ix}` },
            button(
              {
                class: [
                  "accordion-button",
                  (initial_open_accordions === "None" ||
                    (initial_open_accordions === "First" && ix > 0)) &&
                    "collapsed",
                ],
                type: "button",
                "data-bs-toggle": "collapse",
                "data-bs-target": `#a${stateHash}tab${ix}`,
                "aria-expanded": "false",
                "aria-controls": `a${stateHash}tab${ix}`,
              },
              eval_expression(title_formula, r.row, extraArgs.req.user) ||
                "Missing title"
            )
          ),
          div(
            {
              class: [
                "accordion-collapse",
                "collapse",
                !(
                  initial_open_accordions === "None" ||
                  (initial_open_accordions === "First" && ix > 0)
                ) && "show",
              ],
              id: `a${stateHash}tab${ix}`,
              "aria-labelledby": `a${stateHash}head${ix}`,
              "data-bs-parent": `#top${stateHash}`,
            },
            div({ class: ["accordion-body"] }, r.html)
          )
        )
      : r.html;

  const showRow = (r) =>
    div(
      {
        class: [setCols("sm"), setCols("md"), setCols("lg"), setCols("xl")],
      },
      showRowInner(r)
    );
  const is_in_card =
    (!view_decoration && in_card) || view_decoration === "Card";

  const correct_order = ([main, pagin, create]) =>
    istop ? [create, main, pagin] : [main, pagin, create];
  if (groupby) {
    const groups = {};
    for (const r of sresp) {
      const group = eval_expression(groupby, r.row, extraArgs.req.user);
      if (!groups[group]) groups[group] = [];
      groups[group].push(r);
    }
    return div(
      correct_order([
        Object.entries(groups).map(
          ([group, sr]) =>
            h3({ class: "feed-group-header" }, group) +
            (is_in_card && masonry_columns
              ? div({ class: "card-columns" }, sr.map(showRowInner))
              : view_decoration === "Accordion"
              ? div(
                  { class: "accordion", id: `top${stateHash}` },
                  sr.map(showRowInner)
                )
              : div(
                  {
                    class: [
                      "row",
                      !masonry_columns &&
                        is_in_card &&
                        `row-cols-md-${cols[`cols_md`]} g-4 mb-3`,
                    ],
                  },
                  sr.map(showRow)
                ))
        ),
        paginate,
        create_link_div,
      ])
    );
  }
  return div(
    correct_order([
      is_in_card && masonry_columns
        ? div({ class: "card-columns" }, sresp.map(showRowInner))
        : view_decoration === "Accordion"
        ? div(
            { class: "accordion", id: `top${stateHash}` },
            sresp.map(showRowInner)
          )
        : div(
            {
              class: [
                "row",
                !masonry_columns &&
                  is_in_card &&
                  `row-cols-md-${cols.cols_md} row-cols-sm-${cols.cols_sm} row-cols-sm-${cols.cols_lg}  row-cols-cl-${cols.cols_xl} g-4 mb-3`,
              ],
            },
            sresp.map(showRow)
          ),
      paginate,
      create_link_div,
    ])
  );
};

module.exports = {
  /** @type {string} */
  name: "Feed",
  /** @type {string} */
  description:
    "Show multiple rows by displaying a chosen view for each row, stacked or in columns",
  configuration_workflow,
  run,
  get_state_fields,
  /** @type {boolean} */
  display_state_form: false,
  /**
   * @param {object} opts
   * @param {*} opts.create_view_label
   * @returns {string[]|Object[]}
   */
  getStringsForI18n({ create_view_label }) {
    if (create_view_label) return [create_view_label];
    else return [];
  },
  queries: ({
    table_id,
    viewname,
    configuration: { columns, default_state },
    req,
  }) => ({
    async countRowsQuery(state) {
      const table = Table.findOne({ id: table_id });
      const fields = table.getFields();
      const where = await stateFieldsToWhere({ fields, state, table });
      return await table.countRows(where, {
        forUser: req?.user,
        forPublic: !req?.user,
      });
    },
  }),
  connectedObjects: async (configuration) => {
    const fromLayout = extractFromLayout(configuration.layout);
    const toCreate = extractViewToCreate(configuration);
    return toCreate ? mergeConnectedObjects(fromLayout, toCreate) : fromLayout;
  },
};
