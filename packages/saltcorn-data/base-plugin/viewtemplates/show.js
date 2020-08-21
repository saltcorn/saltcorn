const Form = require("../../models/form");
const User = require("../../models/user");
const Field = require("../../models/field");
const View = require("../../models/view");
const Table = require("../../models/table");
const FieldRepeat = require("../../models/fieldrepeat");
const { mkTable } = require("@saltcorn/markup");
const Workflow = require("../../models/workflow");
const { post_btn, link } = require("@saltcorn/markup");
const { getState } = require("../../db/state");

const { div, text, span } = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  stateFieldsToWhere,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions
} = require("../../plugin-helper");
const { action_url, view_linker } = require("./viewable_fields");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Layout",
        builder: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const boolfields = fields.filter(
            f => f.type && f.type.name === "Bool"
          );
          const actions = [
            "Delete",
            ...boolfields.map(f => `Toggle ${f.name}`)
          ];
          const field_view_options = calcfldViewOptions(fields, false);
          const link_view_opts = await get_link_view_opts(
            table,
            context.viewname
          );
          const roles = await User.get_roles();
          const { parent_field_list } = await table.get_parent_relations();
          const {
            child_field_list,
            child_relations
          } = await table.get_child_relations();
          var agg_field_opts = {};
          child_relations.forEach(({ table, key_field }) => {
            agg_field_opts[
              `${table.name}.${key_field.name}`
            ] = table.fields.map(f => f.name);
          });
          const views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewtemplate, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.some(sf => sf.name === "id")
          );

          return {
            fields,
            actions,
            field_view_options,
            link_view_opts,
            parent_field_list,
            child_field_list,
            agg_field_opts,
            roles,
            views,
            mode: "show"
          };
        }
      }
    ]
  });
const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true
  }
];

const initial_config = initial_config_all_fields(false);

const run = async (table_id, viewname, { columns, layout }, state, { req }) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";
  const tbl = await Table.findOne({ id: table_id });
  const fields = await Field.find({ table_id: tbl.id });
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  const qstate = await stateFieldsToWhere({ fields, state, approximate: true });
  const rows = await tbl.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    limit: 1
  });
  const role = req.user ? req.user.role_id : 10;
  if (rows.length !== 1) return "No record selected";
  return render(rows[0], fields, layout, viewname, tbl, role, req);
};

const runMany = async (
  table_id,
  viewname,
  { columns, layout },
  state,
  extra
) => {
  const tbl = await Table.findOne({ id: table_id });
  const fields = await Field.find({ table_id: tbl.id });
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  const qstate = await stateFieldsToWhere({ fields, state });
  const rows = await tbl.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    ...(extra && extra.orderBy && { orderBy: extra.orderBy }),
    ...(extra && extra.orderDesc && { orderDesc: extra.orderDesc })
  });
  const role = extra.req && extra.req.user ? extra.req.user.role_id : 10;

  return rows.map(row => ({
    html: render(row, fields, layout, viewname, tbl, role, extra.req),
    row
  }));
};

const render = (row, fields, layout, viewname, table, role, req) => {
  const blockDispatch = {
    field({ field_name, fieldview }) {
      const val = row[field_name];
      const field = fields.find(fld => fld.name === field_name);
      if (fieldview && field.type === "File") {
        return val ? getState().fileviews[fieldview].run(val) : "";
      } else if (fieldview && field.type.fieldviews[fieldview])
        return field.type.fieldviews[fieldview].run(val);
      else return text(val);
    },
    join_field({ join_field }) {
      const [refNm, targetNm] = join_field.split(".");
      const val = row[targetNm];
      return text(val);
    },
    aggregation({ agg_relation, stat }) {
      const [table, fld] = agg_relation.split(".");
      const targetNm = (stat + "_" + table + "_" + fld).toLowerCase();
      const val = row[targetNm];
      return text(val);
    },
    action({ action_name }) {
      return post_btn(
        action_url(viewname, table, action_name, row),
        action_name,
        req.csrfToken()
      );
    },
    view_link(view) {
      const { key } = view_linker(view, fields);
      return key(row);
    }
  };
  return renderLayout({ blockDispatch, layout, role });
};

module.exports = {
  name: "Show",
  get_state_fields,
  configuration_workflow,
  run,
  runMany,
  initial_config,
  display_state_form: false
};
