const db = require("../db");
const Field = require("../models/field");
const Table = require("../models/table");
const Form = require("../models/form");
const View = require("../models/view");
const Workflow = require("../models/workflow");
const { mkTable, h, post_btn, link } = require("../markup");

const configuration_workflow = () =>
  new Workflow({
    onDone: context => context,
    steps: [
      {
        name: "listfields",
        form: async context => {
          const table_id = context.table_id;

          const fields = await Field.find({ table_id });
          const fldOptions = fields.map(f => f.name);
          var link_view_opts = [];

          const link_views = await View.find({
            table_id
          });
          const viewtemplates = require("./index.js");
          for (const viewrow of link_views) {
            const vt = viewtemplates[viewrow.viewtemplate];
            if (vt.get_state_fields) {
              const sfs = await vt.get_state_fields(
                viewrow.table_id,
                viewrow.name,
                viewrow.configuration
              );
              if (sfs.some(sf => sf.name === "id"))
                link_view_opts.push(`Link to ${viewrow.name}`);
            }
          }

          return new Form({
            fields: [
              {
                name: "field_list",
                label: "Field list",
                input_type: "ordered_multi_select",
                options: [...fldOptions, "Delete", ...link_view_opts]
              }
            ]
          });
        }
      }
    ]
  });
const get_state_fields = async (table_id, viewname, { field_list }) => {
  const table_fields = await Field.find({ table_id });
  var state_fields = [];

  (field_list || []).forEach(fldnm => {
    if (fldnm === "Delete" || fldnm.startsWith("Link to ")) return;
    state_fields.push(table_fields.find(f => f.name == fldnm));
  });

  return state_fields;
};

const run = async (table_id, viewname, { field_list }, state) => {
  const table = await Table.findOne({ id: table_id });

  const fields = await Field.find({ table_id: table.id });
  const tfields = field_list.map(fldnm => {
    if (fldnm === "Delete")
      return {
        label: "Delete",
        key: r =>
          post_btn(
            `/delete/${table.name}/${r.id}?redirect=/view/${viewname}`,
            "Delete"
          )
      };
    else if (fldnm.startsWith("Link to ")) {
      const vnm = fldnm.replace("Link to ", "");
      return {
        label: vnm,
        key: r => link(`/view/${vnm}?id=${r.id}`, vnm)
      };
    } else {
      const f = fields.find(fld => fld.name === fldnm);
      return { label: f.label, key: f.name };
    }
  });

  const rows = await db.select(table.name, state);
  return h(1, table.name) + mkTable(tfields, rows);
};

module.exports = {
  name: "List",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: true
};
