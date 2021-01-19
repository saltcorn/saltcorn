const View = require("../models/view");
const Table = require("../models/table");

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
    return "BOO" + JSON.stringify(attrs);
  },
};
module.exports = { search_or_create };
