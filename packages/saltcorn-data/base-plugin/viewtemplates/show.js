const Form = require("../../models/form");
const Field = require("../../models/field");
const Table = require("../../models/table");
const FieldRepeat = require("../../models/fieldrepeat");
const { mkTable } = require("@saltcorn/markup");
const Workflow = require("../../models/workflow");
const { post_btn, link } = require("@saltcorn/markup");

const { div, text } = require("@saltcorn/markup/tags");
const {
  stateFieldsToWhere,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions
} = require("../../plugin-helper");
const { action_url } = require("./viewable_fields");

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
  return render(row, fields, layout, viewname, tbl);
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
    html: render(row, fields, layout, viewname, tbl),
    row
  }));
};

const render = (row, fields, layout, viewname, table) => {
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
    } else if (segment.type === "join_field") {
      const [refNm, targetNm] = segment.join_field.split(".");
      const val = row[targetNm];
      return text(val);
    } else if (segment.type === "action") {
      return post_btn(
        action_url(viewname, table, segment, row),
        segment.action_name
      );
    } else if (segment.type === "view_link") {
      const [vtype, vrest] = segment.view.split(":");
      switch (vtype) {
        case "Own":
          const vnm = vrest;
          return link(`/view/${vnm}?id=${row.id}`, vnm);
        case "ChildList":
          const [viewnm, tbl, fld] = vrest.split(".");
          return link(`/view/${viewnm}?${fld}=${row.id}`, viewnm);
        case "ParentShow":
          const [pviewnm, ptbl, pfld] = vrest.split(".");
          return row[pfld]
            ? link(`/view/${pviewnm}?id=${row[pfld]}`, pviewnm)
            : "";
      }
    } else if (segment.above) {
      return segment.above.map(s => div(go(s))).join("");
    } else if (segment.besides) {
      const defwidth = Math.round(12 / segment.besides.length);
      return div(
        { class: "row" },
        segment.besides.map((t, ix) =>
          div(
            {
              class: `col-sm-${segment.widths ? segment.widths[ix] : defwidth}`
            },
            go(t)
          )
        )
      );
    } else throw new Error("unknown layout setment" + JSON.stringify(segment));
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
