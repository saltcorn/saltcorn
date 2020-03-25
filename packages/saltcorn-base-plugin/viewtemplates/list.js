const db = require("saltcorn-data/db");
const Field = require("saltcorn-data/models/field");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const View = require("saltcorn-data/models/view");
const Workflow = require("saltcorn-data/models/workflow");
const { mkTable, h, post_btn, link } = require("saltcorn-markup");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "listfields",
        form: async context => {
          const table_id = context.table_id;

          const fields = await Field.find({ table_id });
          const fldOptions = fields.map(f => f.name);
          const link_views = await View.find_possible_links_to_table(table_id);
          const link_view_opts = link_views.map(v => `Link to ${v.name}`);
          return new Form({
            blurb:
              "Finalise your list view by specifying the fields in the table",
            fields: [
              {
                name: "field_list",
                label: "Field list",
                input_type: "ordered_multi_select",
                options: [...fldOptions, "Delete", ...link_view_opts]
              },
              {
                name: "link_to_create",
                label: "Link to create",
                type: "Bool",
                sublabel:
                  "Would you like to add a link at the bottom of the list to create a new item?"
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

const run = async (
  table_id,
  viewname,
  { field_list, link_to_create },
  state
) => {
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
      return { label: f.label, key: f.listKey };
    }
  });
  Object.entries(state).forEach(kv => {
    const field = fields.find(fld => fld.name == kv[0]);
    if (field && field.type.name === "String") {
      state[kv[0]] = { ilike: kv[1] };
    }
  });
  const rows = await db.select(table.name, state);
  const create_link = link_to_create
    ? link(`/edit/${table.name}`, "Add row")
    : "";
  return mkTable(tfields, rows) + create_link;
};

module.exports = {
  name: "List",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: true
};
