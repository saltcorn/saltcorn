const Form = require("../../models/form");
const Field = require("../../models/field");
const Table = require("../../models/table");
const FieldRepeat = require("../../models/fieldrepeat");
const { mkTable } = require("saltcorn-markup");
const Workflow = require("../../models/workflow");
const { get_viewable_fields } = require("./viewable_fields");

const { div, h4, table, tbody, tr, td, text } = require("saltcorn-markup/tags");
const {
  stateFieldsToWhere,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions
} = require("../../plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "showfields",
        builder: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const field_view_options = calcfldViewOptions(fields);
          const link_view_opts = await get_link_view_opts(table, context.viewname);
          const { parent_field_list } = await table.get_parent_relations();
        form1: async context => {
          return { fields, field_view_options, link_view_opts, parent_field_list };
        }
      }
    ]
  });
const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true
  }
];

const initial_config = initial_config_all_fields(false);

const run = async (table_id, viewname, { columns, layout }, { id }) => {
  //console.log(columns);
  //console.log(layout);
  if (typeof id === "undefined") return "No record selected";
  const tbl = await Table.findOne({ id: table_id });
  const fields = await Field.find({ table_id: tbl.id });
  const { joinFields, aggregations } = picked_fields_to_query(columns);
  const [row] = await tbl.getJoinedRows({
    where: { id },
    joinFields,
    aggregations,
    limit: 1
  });
  //const tfields = get_viewable_fields(viewname, tbl, fields, columns, true);
  return render(row, fields, layout);
};

const runMany = async (
  table_id,
  viewname,
  { columns, layout },
  state,
  extra
) => {
  const tbl = await Table.findOne({ id: table_id });
  const fields = await Field.find({ table_id: tbl.id });
  const { joinFields, aggregations } = picked_fields_to_query(columns);
  const qstate = await stateFieldsToWhere({ fields, state });
  const rows = await tbl.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    ...(extra && extra.orderBy && { orderBy: extra.orderBy }),
    ...(extra && extra.orderDesc && { orderDesc: extra.orderDesc })
  });
  //const tfields = get_viewable_fields(viewname, tbl, fields, columns, true);
  return rows.map(row => ({
    html: render(row, fields, layout),
    row
  }));
};

const render = (row, fields, layout) => {
  function go(segment) {
    if (!segment) return "missing layout";
    if (segment.type === "blank") {
      return segment.contents;
    } else if (segment.type === "field") {
      const val = row[segment.field_name];
      const field = fields.find(fld => fld.name === segment.field_name);
      if (segment.fieldview && field.type.fieldviews[segment.fieldview])
        return field.type.fieldviews[segment.fieldview].run(val);
      else return text(val);
    } else if (segment.above) {
      return segment.above.map(go).join("");
    } else if (segment.besides) {
      const defwidth=Math.round(12 / segment.besides.length)
      return div(
        { class: "row" },
        segment.besides.map((t,ix) =>
          div(
            { class: `col-sm-${segment.widths?segment.widths[ix] :defwidth}` },
            go(t)
          )
        )
      );
    } else throw new Error("unknown layout " + JSON.stringify(layout));
  }
  return go(layout);
};

module.exports = {
  name: "Show",
  get_state_fields,
  configuration_workflow,
  run,
  runMany,
  initial_config,
  display_state_form: false
};
