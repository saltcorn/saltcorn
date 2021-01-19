const View = require("../models/view");
const Table = require("../models/table");
const {
  select,
  option,
  a,
  h5,
  span,
  text_attr,
} = require("@saltcorn/markup/tags");
const { select_options } = require("@saltcorn/markup/helpers");

const search_or_create = {
  type: "Key",
  isEdit: true,
  configFields: async (field) => {
    const reftable = await Table.findOne({ name: field.reftable_name });
    const views = await View.find({ table_id: reftable.id });
    return [
      {
        name: "viewname",
        label: "View to create",
        input_type: "select",

        options: views.map((v) => v.name),
      },
      {
        name: "label",
        label: "Label to create",
        type: "String",
      },
    ];
  },
  run: (nm, v, attrs, cls, reqd, field) => {
    return (
      select(
        {
          class: `form-control ${cls} ${field.class || ""}`,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
        },
        select_options(v, field)
      ) +
      a(
        { href: `javascript:ajax_modal('/view/${attrs.viewname}')` },
        attrs.label || "Or create new"
      )
    );
  },
};
module.exports = { search_or_create };
