const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text, div, h4, hr, button } = require("@saltcorn/markup/tags");
const { renderForm, tabs, link } = require("@saltcorn/markup");
const { mkTable } = require("@saltcorn/markup");
const {} = require("./viewable_fields");
const pluralize = require("pluralize");
const { link_view, stateToQueryString } = require("../../plugin-helper");
const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Views",
        form: async (context) => {
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
          const show_view_opts = show_views.map((v) => v.name);
          const create_view_opts = create_views.map((v) => v.name);
          return new Form({
            fields: [
              {
                name: "show_view",
                label: "Item View",
                type: "String",
                required: true,
                attributes: {
                  options: show_view_opts.join(),
                },
              },
              {
                name: "view_to_create",
                label: "Use view to create",
                sublabel:
                  "If user has write permission.  Leave blank to have no link to create a new item",
                type: "String",
                attributes: {
                  options: create_view_opts.join(),
                },
              },
              {
                name: "create_view_display",
                label: "Display create view as",
                type: "String",
                required: true,
                attributes: {
                  options: "Link,Embedded,Popup",
                },
              },
            ],
          });
        },
      },
      {
        name: "Order and layout",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          return new Form({
            fields: [
              {
                name: "order_field",
                label: "Order by",
                type: "String",
                required: true,
                attributes: {
                  options: fields.map((f) => f.name).join(),
                },
              },
              {
                name: "descending",
                label: "Descending",
                type: "Bool",
                required: true,
              },
              {
                name: "cols_sm",
                label: "Columns small screen",
                type: "Integer",
                attributes: {
                  min: 1,
                  max: 4,
                },
                required: true,
                default: 1,
              },
              {
                name: "cols_md",
                label: "Columns medium screen",
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
                label: "Columns large screen",
                type: "Integer",
                attributes: {
                  min: 1,
                  max: 4,
                },
                required: true,
                default: 1,
              },
              {
                name: "cols_xl",
                label: "Columns extra-large screen",
                type: "Integer",
                attributes: {
                  min: 1,
                  max: 4,
                },
                required: true,
                default: 1,
              },
              {
                name: "in_card",
                label: "Each in card?",
                type: "Bool",
                required: true,
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = async (table_id, viewname, { show_view }) => {
  const table_fields = await Field.find({ table_id });
  return table_fields.map((f) => {
    const sf = new Field(f);
    sf.required = false;
    return sf;
  });
};
const run = async (
  table_id,
  viewname,
  {
    show_view,
    order_field,
    descending,
    view_to_create,
    create_view_display,
    in_card,
    ...cols
  },
  state,
  extraArgs
) => {
  const table = await Table.findOne({ id: table_id });

  const sview = await View.findOne({ name: show_view });
  if (!sview)
    return `View ${viewname} incorrectly configured: cannot find view ${show_view}`;
  const sresp = await sview.runMany(state, {
    ...extraArgs,
    orderBy: order_field,
    ...(descending && { orderDesc: true }),
  });
  const role =
    extraArgs && extraArgs.req && extraArgs.req.user
      ? extraArgs.req.user.role_id
      : 10;
  var create_link = "";
  if (view_to_create && role <= table.min_role_write) {
    if (create_view_display === "Embedded") {
      const create_view = await View.findOne({ name: view_to_create });
      create_link = await create_view.run(state, extraArgs);
    } else {
      create_link = link_view(
        `/view/${view_to_create}${stateToQueryString(state)}`,
        `Add ${pluralize(table.name, 1)}`,
        create_view_display === "Popup"
      );
    }
  }
  const setCols = (sz) => `col-${sz}-${Math.round(12 / cols[`cols_${sz}`])}`;

  const showRowInner = (r) =>
    in_card
      ? div({ class: "card shadow mt-4" }, div({ class: "card-body" }, r.html))
      : r.html;

  const showRow = (r) =>
    div(
      {
        class: [setCols("sm"), setCols("md"), setCols("lg"), setCols("xl")],
      },
      showRowInner(r)
    );

  const inner = div(div({ class: "row" }, sresp.map(showRow)), create_link);

  return inner;
};

module.exports = {
  name: "Feed",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: false,
};
