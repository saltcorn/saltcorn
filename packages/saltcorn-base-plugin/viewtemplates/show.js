const Form = require("saltcorn-data/models/form");
const Field = require("saltcorn-data/models/field");
const Table = require("saltcorn-data/models/table");
const FieldRepeat = require("saltcorn-data/models/fieldrepeat");
const { mkTable } = require("saltcorn-markup");
const Workflow = require("saltcorn-data/models/workflow");
const { get_viewable_fields } = require("./viewable_fields");

const { div, h4, table, tbody, tr, td, text } = require("saltcorn-markup/tags");
const {
  field_picker_fields,
  picked_fields_to_query
} = require("saltcorn-data/plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    onDone: context => context,
    steps: [
      {
        name: "showfields",
        form: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const field_picker_repeat = await field_picker_fields({ table });
          return new Form({
            blurb:
              "Finalise your show view by specifying the fields in the table",
            fields: [
              new FieldRepeat({
                name: "columns",
                fields: field_picker_repeat
              }),
              {
                name: "label_style",
                label: "Label style",
                type: "String",
                required: true,
                attributes: {
                  options: "Besides, Above, None"
                }
              }
            ]
          });
        }
      },
      {
        name: "subtables",
        contextField: "subtables",
        form: async context => {
          const tbl = await Table.findOne({ id: context.table_id });
          const rels = await Field.find({ type: `Key to ${tbl.name}` });
          var fields = [];
          for (const rel of rels) {
            const reltbl = await Table.findOne({ id: rel.table_id });
            fields.push({
              name: `${reltbl.name}.${rel.name}`,
              label: `${rel.label} on ${reltbl.name}`,
              type: "Bool"
            });
          }
          return new Form({
            fields,
            blurb:
              "Which related tables would you like to show in sub-lists below the selected item?"
          });
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

const run = async (
  table_id,
  viewname,
  { columns, label_style, subtables },
  { id }
) => {
  if(typeof id==="undefined")
    return "No record selected"
    
  const tbl = await Table.findOne({ id: table_id });
  const fields = await Field.find({ table_id: tbl.id });
  const { joinFields, aggregations } = picked_fields_to_query(columns);
  const [row] = await tbl.getJoinedRows({
    where: { id },
    joinFields,
    aggregations,
    limit: 1
  });
  const tfields = get_viewable_fields(viewname, tbl, fields, columns);

  //todo: to list-show-list
  var reltbls = [];
  for (const rel of Object.keys(subtables)) {
    if (subtables[rel]) {
      const [reltblnm, relfld] = rel.split(".");
      const reltbl = await Table.findOne({ name: reltblnm });
      const rows = await reltbl.getJoinedRows({
        where: {
          [relfld]: id
        }
      });
      const relfields = await reltbl.getFields();
      const trfields = relfields.map(f => ({ label: f.label, key: f.listKey }));
      reltbls.push(div(h4(reltbl.name), mkTable(trfields, rows)));
    }
  }
  if (label_style === "Besides") {
    const trows = tfields.map(f =>
      tr(
        td(text(f.label)),
        td(typeof f.key === "string" ? row[f.key] : f.key[row])
      )
    );
    return div([table(tbody(trows)), ...reltbls]);
  } else if (label_style === "Above") {
    const trows = tfields.map(f =>
      div(
        div(text(f.label)),
        div(typeof f.key === "string" ? row[f.key] : f.key[row])
      )
    );
    return div([...trows, ...reltbls]);
  } else {
    const trows = tfields.map(f =>
      div(typeof f.key === "string" ? row[f.key] : f.key[row])
    );
    return div([...trows, ...reltbls]);
  }
};

module.exports = {
  name: "Show",
  get_state_fields,
  configuration_workflow,
  run,
  display_state_form: false
};
