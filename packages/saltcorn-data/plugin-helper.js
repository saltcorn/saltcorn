const View = require("./models/view");
const Field = require("./models/field");
const Table = require("./models/table");
const State = require("./db/state");

const calcfldViewOptions = fields => {
  var fvs = {};
  fields.forEach(f => {
    if (f.type && f.type.fieldviews) {
      fvs[f.name] = Object.keys(f.type.fieldviews);
    }
  });
  return fvs;
};

const get_link_view_opts = async (table, viewname) => {
  const own_link_views = await View.find_possible_links_to_table(table.id);
  const link_view_opts = own_link_views.map(v => ({
    label: v.name,
    name: `Own:${v.name}`
  }));
  const child_views = await get_child_views(table, viewname);
  for (const { relation, related_table, views } of child_views) {
    for (const view of views) {
      link_view_opts.push({
        name: `ChildList:${view.name}.${related_table.name}.${relation.name}`,
        label: `${view.name} of ${relation.label} on ${related_table.name}`
      });
    }
  }
  return link_view_opts;
};
const field_picker_fields = async ({ table, viewname }) => {
  const fields = await table.getFields();
  const boolfields = fields.filter(f => f.type && f.type.name === "Bool");
  const actions = ["Delete", ...boolfields.map(f => `Toggle ${f.name}`)];
  const fldOptions = fields.map(f => f.name);
  const fldViewOptions = calcfldViewOptions(fields);

  const link_view_opts = await get_link_view_opts(table, viewname);

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
      class: "field_name",
      label: "Field",
      type: "String",
      required: true,
      attributes: {
        options: fldOptions.join()
      },
      showIf: { ".coltype": "Field" }
    },
    {
      name: "fieldview",
      label: "Field view",
      type: "String",
      required: false,
      attributes: {
        calcOptions: [".field_name", fldViewOptions]
      },
      showIf: { ".coltype": "Field" }
    },
    {
      name: "action_name",
      label: "Action",
      type: "String",
      required: true,
      attributes: {
        options: actions.join()
      },
      showIf: { ".coltype": "Action" }
    },
    {
      name: "view",
      label: "View",
      type: "String",
      required: true,
      attributes: {
        options: link_view_opts
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

const get_child_views = async (table, viewname) => {
  const rels = await Field.find({ reftable_name: table.name });
  var child_views = [];
  for (const relation of rels) {
    const related_table = await Table.findOne({ id: relation.table_id });
    const views = await View.find_table_views_where(
      relation.table_id,
      ({ state_fields, viewrow }) =>
        viewrow.name !== viewname && state_fields.every(sf => !sf.required)
    );
    child_views.push({ relation, related_table, views });
  }
  return child_views;
};

const get_parent_views = async (table, viewname) => {
  var parent_views = [];
  const parentrels = (await table.getFields()).filter(f => f.is_fkey);
  for (const relation of parentrels) {
    const related_table = await Table.findOne({
      name: relation.reftable_name
    });
    const views = await View.find_table_views_where(
      related_table.id,
      ({ state_fields, viewrow }) =>
        viewrow.name !== viewname && state_fields.some(sf => sf.name === "id")
    );

    parent_views.push({ relation, related_table, views });
  }
  return parent_views;
};

const picked_fields_to_query = columns => {
  var joinFields = {};
  var aggregations = {};
  columns.forEach(column => {
    if (column.type === "JoinField") {
      const [refNm, targetNm] = column.join_field.split(".");
      joinFields[targetNm] = { ref: refNm, target: targetNm };
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
    }
  });

  return { joinFields, aggregations };
};

module.exports = {
  field_picker_fields,
  picked_fields_to_query,
  get_child_views,
  get_parent_views
};
