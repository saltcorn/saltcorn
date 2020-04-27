const { post_btn, link } = require("saltcorn-markup");
const { text } = require("saltcorn-markup/tags");

const action_url = (viewname, table, column, r) => {
  if (column.action_name === "Delete")
    return `/delete/${table.name}/${r.id}?redirect=/view/${viewname}`;
  else if (column.action_name.startsWith("Toggle")) {
    const field_name = column.action_name.replace("Toggle ", "");
    return `/edit/toggle/${table.name}/${r.id}/${field_name}?redirect=/view/${viewname}`;
  }
};

const get_viewable_fields = (viewname, table, fields, columns, isShow) =>
  columns.map(column => {
    if (column.type === "Action")
      return {
        label: column.action_name,
        key: r =>
          post_btn(action_url(viewname, table, column, r), column.action_name)
      };
    else if (column.type === "ViewLink") {
      const [vtype, vnm] = column.view.split(":");
      switch (vtype) {
        case "Own":
          return {
            label: vnm,
            key: r => link(`/view/${vnm}?id=${r.id}`, vnm)
          };
        default:
          throw new Error(column.view);
      }
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
        label: text(column.stat + " " + table),
        key: text(targetNm)
        // sortlink: `javascript:sortby('${text(targetNm)}')`
      };
    } else if (column.type === "Field") {
      const f = fields.find(fld => fld.name === column.field_name);

      return {
        label: text(f.label),
        key:
          column.fieldview && f.type.fieldviews[column.fieldview]
            ? row => f.type.fieldviews[column.fieldview].run(row[f.name])
            : isShow
            ? f.type.showAs
              ? row => f.type.showAs(row[f.name])
              : row => text(row[f.name])
            : f.listKey,
        sortlink: `javascript:sortby('${text(f.name)}')`
      };
    }
  });

const stateFieldsToWhere = ({ fields, state }) => {
  var qstate = {};
  Object.entries(state).forEach(([k, v]) => {
    if (k === "_fts") {
      qstate[k] = { searchTerm: v, fields };
      return;
    }
    const field = fields.find(fld => fld.name == k);
    if (
      field &&
      field.type.name === "String" &&
      !(field.attributes && field.attributes.options)
    ) {
      qstate[k] = { ilike: v };
    } else if (field) qstate[k] = v;
  });
  return qstate;
};

module.exports = { stateFieldsToWhere, get_viewable_fields };
