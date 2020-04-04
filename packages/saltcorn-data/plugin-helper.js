const View = require("./models/view");

const field_picker_fields = async ({ table }) => {
  const fields = await table.getFields();
  const fldOptions = fields.map(f => f.name);
  const link_views = await View.find_possible_links_to_table(table.id);
  const link_view_opts = link_views.map(v => v.name);
  const { parent_field_list } = await table.get_parent_relations();
  const {
    child_field_list,
    child_relations
  } = await table.get_child_relations();
  const agg_field_opts = child_relations.map(({ table, key_field }) => ({
    name: `agg_field_${table.name}_${key_field.name}`,
    label: "On Field",
    type: "String",
    required: true,
    attributes: {
      options: table.fields.map(f => f.name).join()
    },
    showIf: {
      ".agg_relation": `${table.name}.${key_field.name}`,
      ".coltype": "Aggregation"
    }
  }));
  return [
    {
      name: "type",
      label: "Type",
      type: "String",
      class: "coltype",
      required: true,
      attributes: {
        //TODO omit when no options
        options: [
          {
            name: "Field",
            label: `Field in ${table.name} table`
          },
          { name: "Action", label: "Action on row" },
          { name: "ViewLink", label: "Link to other view" },
          { name: "JoinField", label: "Join Field" },
          { name: "Aggregation", label: "Aggregation" }
        ]
      }
    },
    {
      name: "field_name",
      label: "Field",
      type: "String",
      required: true,
      attributes: {
        options: fldOptions.join()
      },
      showIf: { ".coltype": "Field" }
    },
    {
      name: "action_name",
      label: "Action",
      type: "String",
      required: true,
      attributes: {
        options: "Delete,Edit"
      },
      showIf: { ".coltype": "Action" }
    },
    {
      name: "view",
      label: "View",
      type: "String",
      required: true,
      attributes: {
        options: link_view_opts.join()
      },
      showIf: { ".coltype": "ViewLink" }
    },
    {
      name: "join_field",
      label: "Join Field",
      type: "String",
      required: true,
      attributes: {
        options: parent_field_list.join()
      },
      showIf: { ".coltype": "JoinField" }
    },
    {
      name: "agg_relation",
      label: "Relation",
      type: "String",
      class: "agg_relation",
      required: true,
      attributes: {
        options: child_field_list.join()
      },
      showIf: { ".coltype": "Aggregation" }
    },
    ...agg_field_opts,
    {
      name: "stat",
      label: "Statistic",
      type: "String",
      required: true,
      attributes: {
        options: "Count,Avg,Sum,Max,Min"
      },
      showIf: { ".coltype": "Aggregation" }
    },
    {
      name: "state_field",
      label: "In search form",
      type: "Bool",
      showIf: { ".coltype": "Field" }
    }
  ];
};

const picked_fields_to_query=(table, fields, columns, escapexss)=> {
  var joinFields = {};
  var aggregations = {};
  const tfields = columns.map(column => {
    const fldnm = column.field_name;
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
      joinFields[targetNm] = { ref: refNm, target: targetNm };
      return {
        label: targetNm,
        key: targetNm
        // sortlink: `javascript:sortby('${text(targetNm)}')`
      };
    } else if (column.type === "Aggregation") {
      //console.log(column)
      const [table, fld] = column.agg_relation.split(".");
      const field = column[`agg_field_${table}_${fld}`];
      const targetNm = (column.stat + "_" + table + "_" + fld).toLowerCase();
      aggregations[targetNm] = {
        table,
        ref: fld,
        field,
        aggregate: column.stat
      };
      return {
        label: targetNm,
        key: targetNm
        // sortlink: `javascript:sortby('${text(targetNm)}')`
      };
    } else if (column.type === "Field") {
      const f = fields.find(fld => fld.name === column.field_name);
      return {
        label: f.label,
        key: f.listKey,
        sortlink: `javascript:sortby('${escapexss(f.name)}')`
      };
    }
  });

  return {joinFields, aggregations, tfields}
}

module.exports = { field_picker_fields, picked_fields_to_query };
