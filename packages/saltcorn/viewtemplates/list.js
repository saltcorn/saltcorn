const db = require("../db");
const Field = require("../models/field");
const View = require("../models/view");
const { mkTable, h, post_btn, link } = require("../markup");

const configuration_form = async table_name => {
  const table = await db.get_table_by_name(table_name);

  const fields = await Field.get_by_table_id(table.id);
  const fldOptions = fields.map(f => f.name);
  const viewtemplates = Object.entries(require("./index.js"))
    .filter(
      vt =>
        vt[1].get_state_fields &&
        vt[1].get_state_fields().some(sf => sf.name === "id")
    )
    .map(vt => vt[0]);

  const link_views = await View.find({
    table_id: table.id,
    viewtemplate: { in: viewtemplates }
  });
  const link_view_opts = link_views.map(v => `Link to ${v.name}`);
  return [
    {
      name: "field_list",
      label: "Field list",
      input_type: "ordered_multi_select",
      options: [...fldOptions, "Delete", ...link_view_opts]
    }
  ];
};

const run = async (table_id, viewname, { field_list }) => {
  const table = await db.get_table_by_id(table_id);

  const fields = await Field.get_by_table_id(table.id);
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

  const rows = await db.select(table.name);
  return h(1, table.name) + mkTable(tfields, rows);
};

module.exports = {
  name: "List",
  configuration_form,
  run
};
