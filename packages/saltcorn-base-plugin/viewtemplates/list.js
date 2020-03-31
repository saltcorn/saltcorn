const Field = require("saltcorn-data/models/field");
const FieldRepeat = require("saltcorn-data/models/fieldrepeat");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const View = require("saltcorn-data/models/view");
const Workflow = require("saltcorn-data/models/workflow");
const { mkTable, h, post_btn, link } = require("saltcorn-markup");
const { text, script } = require("saltcorn-markup/tags");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "listfields",
        form: async context => {
          const table_id = context.table_id;
          const table = await Table.findOne({ id: table_id });
          const fields = await table.getFields();
          const fldOptions = fields.map(f => text(f.name));
          const link_views = await View.find_possible_links_to_table(table_id);
          const link_view_opts = link_views.map(v => text(v.name));
          const { parent_field_list } = await table.get_parent_relations();
          return new Form({
            blurb:
              "Finalise your list view by specifying the fields in the table",
            fields: [
              new FieldRepeat({
                name: "columns",
                fields: [
                  {
                    name: "type",
                    label: "Type",
                    type: "String",
                    class: "coltype",
                    required: true,
                    attributes: {
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
                    showIf: [".coltype", "Field"]
                  },
                  {
                    name: "action_name",
                    label: "Action",
                    type: "String",
                    required: true,
                    attributes: {
                      options: "Delete,Edit"
                    },
                    showIf: [".coltype", "Action"]
                  },
                  {
                    name: "view",
                    label: "View",
                    type: "String",
                    required: true,
                    attributes: {
                      options: link_view_opts.join()
                    },
                    showIf: [".coltype", "ViewLink"]
                  },
                  {
                    name: "join_field",
                    label: "Join Field",
                    type: "String",
                    required: true,
                    attributes: {
                      options: parent_field_list.join()
                    },
                    showIf: [".coltype", "JoinField"]
                  },
                  {
                    name: "state_field",
                    label: "In search form",
                    type: "Bool",
                    showIf: [".coltype", "Field"]
                  }
                ]
              }),
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
const get_state_fields = async (table_id, viewname, { columns }) => {
  const table_fields = await Field.find({ table_id });
  var state_fields = [];

  (columns || []).forEach(column => {
    if (column.type === "Field" && column.state_field)
      state_fields.push(table_fields.find(f => f.name == column.field_name));
  });
  state_fields.push({ name: "_sortby", input_type: "hidden" });
  state_fields.push({ name: "_page", input_type: "hidden" });
  return state_fields;
};

const run = async (table_id, viewname, { columns, link_to_create }, state) => {
  //console.log(state);
  const table = await Table.findOne({ id: table_id });

  const fields = await Field.find({ table_id: table.id });
  var joinFields = {};
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
    } else if (column.type === "Field") {
      const f = fields.find(fld => fld.name === column.field_name);
      return {
        label: f.label,
        key: f.listKey,
        sortlink: `javascript:sortby('${text(f.name)}')`
      };
    }
  });
  var qstate = {};
  Object.entries(state).forEach(([k, v]) => {
    const field = fields.find(fld => fld.name == k);
    if (field) qstate[k] = v;
    if (
      field &&
      field.type.name === "String" &&
      !(field.attributes && field.attributes.options)
    ) {
      qstate[k] = { ilike: v };
    }
  });
  const rows_per_page = 20;
  const current_page = parseInt(state._page) || 1;
  const rows = await table.getJoinedRows({
    where: qstate,
    joinFields,
    limit: rows_per_page,
    offset: (current_page - 1) * rows_per_page,
    ...(state._sortby ? { orderBy: state._sortby } : { orderBy: "id" })
  });

  var page_opts = {};

  if (rows.length === rows_per_page) {
    const nrows = await table.countRows(qstate);
    if (nrows > rows_per_page) {
      page_opts = {
        pagination: {
          current_page,
          pages: Math.ceil(nrows / rows_per_page),
          get_page_link: n => `javascript:gopage(${n})`
        }
      };
    }
  }
  const create_link = link_to_create
    ? link(`/edit/${table.name}`, "Add row")
    : "";
  return mkTable(tfields, rows, page_opts) + create_link;
};

module.exports = {
  name: "List",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: true
};
