const {  post_btn, link } = require("saltcorn-markup");
const { text } = require("saltcorn-markup/tags");

const get_viewable_fields = (viewname, table, fields, columns, isShow) => columns.map(column => {
    if (column.type === "Action")
      return {
        label: "Delete",
        key: r =>
          post_btn(
            `/delete/${table.name}/${r.id}?redirect=/view/${viewname}`,
            "Delete"
          )
      };
    else if (column.type === "ViewLink") {
      const vnm = column.view;
      return {
        label: vnm,
        key: r => link(`/view/${vnm}?id=${r.id}`, vnm)
      };
    } else if (column.type === "JoinField") {
      const [refNm, targetNm] = column.join_field.split(".");
      return {
        label: text(targetNm),
        key: text(targetNm)
        // sortlink: `javascript:sortby('${text(targetNm)}')`
      };
    } else if (column.type === "Aggregation") {
      //console.log(column)
      const [table, fld] = column.agg_relation.split(".");
      const targetNm = (column.stat + "_" + table + "_" + fld).toLowerCase();

      return {
        label: text(targetNm),
        key: text(targetNm)
        // sortlink: `javascript:sortby('${text(targetNm)}')`
      };
    } else if (column.type === "Field") {
      const f = fields.find(fld => fld.name === column.field_name);
      return {
        label: text(f.label),
        key: isShow ? (f.type.showAs ? f.type.showAs(row[f.name]) : text(row[f.name])) : f.listKey,
        sortlink: `javascript:sortby('${text(f.name)}')`
      };
    }
  });

  module.exports = { get_viewable_fields}