const View = require("../models/view");
const Table = require("../models/table");
const {
  select,
  option,
  a,
  h5,
  span,
  text_attr,
  script,
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
        {
          href: `javascript:ajax_modal('/view/${attrs.viewname}',{submitReload: false,onClose: soc_process_${nm}})`,
        },
        attrs.label || "Or create new"
      ) +
      script(`
      function soc_process_${nm}(){
        $.ajax('/api/${field.reftable_name}', {
          success: function (res, textStatus, request) {
            console.log(res);
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
module.exports = { search_or_create };
