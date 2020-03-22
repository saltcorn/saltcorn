const db = require("../db");
const Form = require("../models/form");
const Field = require("../models/field");
const Table = require("../models/table");
const { mkTable } = require("../markup");
const Workflow = require("../models/workflow");

const { div, h1, h2, h3, table, tbody, tr, td } = require("../markup/tags");

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
            fields
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
  const trows = fields.map(f => tr([td(f.label), td("" + row[f.name])]));
  var reltbls = [];
  for (const rel of Object.keys(rels)) {
    if (rels[rel]) {
      const [reltblnm, relfld] = rel.split(".");
      const reltbl = await Table.findOne({ name: reltblnm });
      const rows = await reltbl.getJoinedRows({
        [relfld]: id
      });
      const relfields = await reltbl.getFields();
      var tfields = relfields.map(f => ({ label: f.label, key: f.name }));
      reltbls.push(div(h3(reltbl.name), mkTable(tfields, rows)));
    }
  }
  return div([h1("Show ", tbl.name), table(tbody(trows)), ...reltbls]);
};

module.exports = {
  name: "Show",
  get_state_fields,
  configuration_workflow,
  run,
  display_state_form: true
};
