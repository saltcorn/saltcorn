const Field = require("../../models/field");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text, div, h4, hr, button } = require("@saltcorn/markup/tags");
const { pagination } = require("@saltcorn/markup/helpers");
const { renderForm, tabs, link } = require("@saltcorn/markup");
const { mkTable } = require("@saltcorn/markup");
const {} = require("./viewable_fields");
const pluralize = require("pluralize");
const {
  link_view,
  stateToQueryString,
  stateFieldsToWhere,
  stateFieldsToQuery,
  readState,
} = require("../../plugin-helper");
const { InvalidConfiguration } = require("../../utils");
const { getState } = require("../../db/state");

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Views"),
        form: async (context) => {
          const table = await Table.findOne(context.table_id);
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
                sublabel: req.__(
                  "The underlying individual view of each table row"
                ),
                required: true,
                attributes: {
                  options: show_view_opts,
                },
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
              },
              {
                name: "create_view_label",
                label: req.__("Label for create"),
                sublabel: req.__(
                  "Label in link or button to create. Leave blank for a default label"
                ),
                type: "String",
                showIf: { create_view_display: ["Link", "Popup"] },
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
                    },
                  ]
                : []),
            ],
          });
        },
      },
    ],
  });

const get_state_fields = async (table_id, viewname, { show_view }) => {
  const table_fields = await Field.find({ table_id });
  return table_fields
    .filter((f) => !f.primary_key)
    .map((f) => {
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
    masonry_columns,
    rows_per_page = 20,
    hide_pagination,
    create_view_label,
    create_view_location,
    always_create_view,
    ...cols
  },
  state,
  extraArgs
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  readState(state, fields);
  const appState = getState();
  const locale = extraArgs.req.getLocale();
  const __ = (s) => appState.i18n.__({ phrase: s, locale }) || s;
};

module.exports = {
  name: "Room",
  description: "Real-time room for chat",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: false,
  getStringsForI18n({ create_view_label }) {
    if (create_view_label) return [create_view_label];
    else return [];
  },
};
