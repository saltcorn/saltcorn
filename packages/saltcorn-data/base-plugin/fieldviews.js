const View = require("../models/view");
const Table = require("../models/table");
const {
  option,
  a,
  h5,
  span,
  text_attr,
  script,
} = require("@saltcorn/markup/tags");
const tags = require("@saltcorn/markup/tags");
const { select_options } = require("@saltcorn/markup/helpers");

const select = {
  type: "Key",
  isEdit: true,
  configFields: () => [    {
      name: "neutral_label",
      label: "Neutral label",
      type: "String",
    },
    {
      name: "force_required",
      label: "Force required",
      sublabel: "User must select a value, even if the table field is not required",
      type: "Bool",
    },

  ],
  run: (nm, v, attrs, cls, reqd, field) => {
    return (
      tags.select(
        {
          class: `form-control ${cls} ${field.class || ""}`,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
        },
        select_options(v, field)
      )
    );
  },
};

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
      tags.select(
        {
          class: `form-control ${cls} ${field.class || ""}`,
          name: text_attr(nm),
          id: `input${text_attr(nm)}`,
        },
        select_options(v, field)
      ) +
      a(
        {
          href: `javascript:ajax_modal('/view/${attrs.viewname}',{submitReload: false,onClose: soc_process_${nm}})`,
        },
        attrs.label || "Or create new"
      ) +
      script(`
      function soc_process_${nm}(){
        $.ajax('/api/${field.reftable_name}', {
          success: function (res, textStatus, request) {
            var opts = res.success.map(x=>'<option value="'+x.id+'">'+x.${
              attrs.summary_field
            }+'</option>').join("")
            ${reqd ? "" : `opts = '<option></option>'+opts`}
            $('#input${text_attr(
              nm
            )}').html(opts).prop('selectedIndex', res.success.length${
        reqd ? "-1" : ""
      }); 
          }
        })
      }`)
    );
  },
};
module.exports = { select, search_or_create };
