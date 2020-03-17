const db = require("../db");
const Field = require("../models/field");
const Table = require("../models/table");
const { mkTable } = require("../markup");

const { div, h1, h2, h3, table, tbody, tr, td } = require("../markup/tags");

const configuration_form = async table_name => {
  const tbl = await db.get_table_by_name(table_name);
  const rels = await Field.find({ type: `Key to ${tbl.name}` });
  var flds = [];
  for (const rel of rels) {
    const reltbl = await Table.find({ id: rel.table_id });
    flds.push({
      name: `${reltbl.name}.${rel.name}`,
      label: `${rel.label} on ${reltbl.name}`,
      type: "Bool"
    });
  }
  return flds;
};

const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true
  }
];

const run = async (table_id, viewname, rels, { id }) => {
  const tbl = await db.get_table_by_id(table_id);

  const fields = await Field.get_by_table_id(tbl.id);
  const row = await db.selectOne(tbl.name, { id });
  const trows = fields.map(f => tr([td(f.label), td("" + row[f.name])]));
  var reltbls = [];
  for (const rel of Object.keys(rels)) {
    const [reltblnm, relfld] = rel.split(".");
    const reltbl = await Table.find({ name: reltblnm });
    const rows = await reltbl.getJoinedRows({ [relfld]: id });
    const relfields = await reltbl.getFields();
    var tfields = relfields.map(f => ({ label: f.label, key: f.name }));
    reltbls.push(div(h3(reltbl.name), mkTable(tfields, rows)));
  }
  return div([h1("Show ", tbl.name), table(tbody(trows)), ...reltbls]);
};

module.exports = {
  name: "Show",
  get_state_fields,
  configuration_form,
  run,
  display_state_form: true
};
