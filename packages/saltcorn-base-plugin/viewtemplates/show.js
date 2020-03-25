const db = require("saltcorn-data/db");
const Form = require("saltcorn-data/models/form");
const Field = require("saltcorn-data/models/field");
const Table = require("saltcorn-data/models/table");
const { mkTable } = require("saltcorn-markup");
const Workflow = require("saltcorn-data/models/workflow");

const { div, h4, table, tbody, tr, td } = require("saltcorn-markup/tags");

const configuration_workflow = () =>
  new Workflow({
    onDone: context => context,
    steps: [
      {
        name: "subtables",
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

const run = async (table_id, viewname, rels, { id }) => {
  const tbl = await Table.findOne({ id: table_id });
  const fields = await Field.find({ table_id: tbl.id });

  const row = await db.selectOne(tbl.name, { id });
  const trows = fields.map(f =>
    tr(
      td(f.label),
      td("" + (f.type.showAs ? f.type.showAs(row[f.name]) : row[f.name]))
    )
  );
  var reltbls = [];
  for (const rel of Object.keys(rels)) {
    if (rels[rel]) {
      const [reltblnm, relfld] = rel.split(".");
      const reltbl = await Table.findOne({ name: reltblnm });
      const rows = await reltbl.getJoinedRows({
        [relfld]: id
      });
      const relfields = await reltbl.getFields();
      var tfields = relfields.map(f => ({ label: f.label, key: f.listKey }));
      reltbls.push(div(h4(reltbl.name), mkTable(tfields, rows)));
    }
  }
  return div([table(tbody(trows)), ...reltbls]);
};

module.exports = {
  name: "Show",
  get_state_fields,
  configuration_workflow,
  run,
  display_state_form: true
};
