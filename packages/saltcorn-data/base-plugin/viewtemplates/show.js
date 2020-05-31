const Form = require("../../models/form");
const Field = require("../../models/field");
const Table = require("../../models/table");
const FieldRepeat = require("../../models/fieldrepeat");
const { mkTable } = require("@saltcorn/markup");
const Workflow = require("../../models/workflow");
const { post_btn, link } = require("@saltcorn/markup");

const { div, text,span } = require("@saltcorn/markup/tags");
const {
  stateFieldsToWhere,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions
} = require("../../plugin-helper");
const { action_url, view_linker, asyncMap } = require("./viewable_fields");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "showfields",
        builder: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const boolfields = fields.filter(
            f => f.type && f.type.name === "Bool"
          );
          const actions = [
            "Delete",
            ...boolfields.map(f => `Toggle ${f.name}`)
          ];
          const field_view_options = calcfldViewOptions(fields);
          const link_view_opts = await get_link_view_opts(
            table,
            context.viewname
          );
          const { parent_field_list } = await table.get_parent_relations();
          return {
            fields,
            actions,
            field_view_options,
            link_view_opts,
            parent_field_list
          };
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

const run = async (table_id, viewname, { columns, layout }, state) => {
  //console.log(columns);
  //console.log(layout);
  const tbl = await Table.findOne({ id: table_id });
  const fields = await Field.find({ table_id: tbl.id });
  const { joinFields, aggregations } = picked_fields_to_query(columns);
  const rows = await tbl.getJoinedRows({
    where: state,
    joinFields,
    aggregations,
    limit: 1
  });
  if (rows.length !== 1) return "No record selected";
  return await render(rows[0], fields, layout, viewname, tbl);
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
  return await asyncMap(rows, async row => ({
    html: await render(row, fields, layout, viewname, tbl),
    row
  }));
};
const wrapBlock=(segment, inner)=> 
  segment.block ? div(inner) : span(inner);

const render = async (row, fields, layout, viewname, table) => {
  async function go(segment) {
    if (!segment) return "missing layout";
    if (segment.type === "blank") {
      return wrapBlock(segment, segment.contents)
    } if (segment.type === "line_break") {
      return '<br />'
    }else if (segment.type === "field") {
      const val = row[segment.field_name];
      const field = fields.find(fld => fld.name === segment.field_name);
      if (segment.fieldview && field.type.fieldviews[segment.fieldview])
        return wrapBlock(segment, field.type.fieldviews[segment.fieldview].run(val));
      else return wrapBlock(segment, text(val));
    } else if (segment.type === "join_field") {
      const [refNm, targetNm] = segment.join_field.split(".");
      const val = row[targetNm];
      return wrapBlock(segment, text(val));
    } else if (segment.type === "action") {
      return wrapBlock(segment, post_btn(
        action_url(viewname, table, segment, row),
        segment.action_name)
      );
    } else if (segment.type === "view_link") {
      const { key } = await view_linker(segment, fields);
      return wrapBlock(segment,key(row));
    } else if (segment.above) {
      return (await asyncMap(segment.above, async s => await go(s))).join(
        ""
      );
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      return div(
        { class: "row" },
        await asyncMap(segment.besides, async (t, ix) =>
          div(
            {
              class: `col-sm-${segment.widths ? segment.widths[ix] : defwidth}`
            },
            await go(t)
          )
        )
      );
    } else throw new Error("unknown layout setment" + JSON.stringify(segment));
  }
  return await go(layout);
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
