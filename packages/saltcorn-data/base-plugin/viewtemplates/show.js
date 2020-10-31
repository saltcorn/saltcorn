const Form = require("../../models/form");
const User = require("../../models/user");
const Field = require("../../models/field");
const View = require("../../models/view");
const File = require("../../models/file");
const Table = require("../../models/table");
const FieldRepeat = require("../../models/fieldrepeat");
const { mkTable } = require("@saltcorn/markup");
const Workflow = require("../../models/workflow");
const { post_btn, link } = require("@saltcorn/markup");
const { getState } = require("../../db/state");
const { eachView } = require("../../models/layout");

const { div, text, span } = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  stateFieldsToWhere,
  stateFieldsToQuery,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions,
} = require("../../plugin-helper");
const { action_url, view_linker } = require("./viewable_fields");
const db = require("../../db");
const { asyncMap } = require("../../utils");
const { traverseSync } = require("../../models/layout");
const { get_expression_function } = require("../../models/expression");
const v8 = require("v8");

const structuredClone = (obj) => {
  return v8.deserialize(v8.serialize(obj));
};

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Layout"),
        builder: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          fields.push(new Field({ name: "id", label: "id", type: "Integer" }));

          const boolfields = fields.filter(
            (f) => f.type && f.type.name === "Bool"
          );
          const actions = [
            "Delete",
            ...boolfields.map((f) => `Toggle ${f.name}`),
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
            child_relations,
          } = await table.get_child_relations();
          var agg_field_opts = {};
          child_relations.forEach(({ table, key_field }) => {
            agg_field_opts[
              `${table.name}.${key_field.name}`
            ] = table.fields
              .filter((f) => !f.calculated || f.stored)
              .map((f) => f.name);
          });
          const views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewtemplate, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.some((sf) => sf.name === "id")
          );
          const images = await File.find({ mime_super: "image" });
          return {
            fields,
            images,
            actions,
            field_view_options,
            link_view_opts,
            parent_field_list,
            child_field_list,
            agg_field_opts,
            roles,
            views,
            mode: "show",
          };
        },
      },
    ],
  });
const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true,
  },
];

const initial_config = initial_config_all_fields(false);

const run = async (table_id, viewname, { columns, layout }, state, extra) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return "View not yet built";
  const tbl = await Table.findOne({ id: table_id });
  const fields = await tbl.getFields();

  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  const qstate = await stateFieldsToWhere({ fields, state, approximate: true });
  const rows = await tbl.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    limit: 2,
  });
  if (rows.length !== 1) return extra.req.__("No record selected");

  return (await renderRows(tbl, viewname, { columns, layout }, extra, rows))[0];
};

const renderRows = async (
  table,
  viewname,
  { columns, layout },
  extra,
  rows
) => {
  //console.log(columns);
  //console.log(layout);
  if (!columns || !layout) return req.__("View not yet built");

  const fields = await table.getFields();

  const role = extra.req.user ? extra.req.user.role_id : 10;
  var views = {};
  const getView = async (nm) => {
    if (views[nm]) return views[nm];
    const view = await View.findOne({ name: nm });
    if (!view) return false;
    view.table = await Table.findOne({ id: view.table_id });
    views[nm] = view;
    return view;
  };

  return await asyncMap(rows, async (row) => {
    await eachView(layout, async (segment) => {
      const view = await getView(segment.view);
      if (!view)
        segment.contents = `View ${viewname} incorrectly configured: cannot find view ${segment.view}`;
      else if (view.viewtemplateObj.renderRows) {
        segment.contents = (
          await view.viewtemplateObj.renderRows(
            view.table,
            view.name,
            view.configuration,
            extra,
            [row]
          )
        )[0];
      } else {
        segment.contents = await view.run({ id: row.id }, extra);
      }
    });
    return render(row, fields, layout, viewname, table, role, extra.req);
  });
};

const runMany = async (
  table_id,
  viewname,
  { columns, layout },
  state,
  extra
) => {
  const tbl = await Table.findOne({ id: table_id });
  const fields = await tbl.getFields();
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  const qstate = await stateFieldsToWhere({ fields, state });
  const q = await stateFieldsToQuery({ state, fields });

  const rows = await tbl.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    ...(extra && extra.limit && { limit: extra.limit }),
    ...(extra && extra.orderBy && { orderBy: extra.orderBy }),
    ...(extra && extra.orderDesc && { orderDesc: extra.orderDesc }),
    ...q,
  });

  const rendered = await renderRows(
    tbl,
    viewname,
    { columns, layout },
    extra,
    rows
  );

  return rendered.map((html, ix) => ({ html, row: rows[ix] }));
};

const render = (row, fields, layout0, viewname, table, role, req) => {
  const evalMaybeExpr = (segment, key, fmlkey) => {
    if (segment.isFormula && segment.isFormula[fmlkey || key]) {
      const f = get_expression_function(segment[key], fields);
      segment[key] = f(row);
    }
  };
  const layout = structuredClone(layout0);
  traverseSync(layout, {
    link(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "text");
    },
    blank(segment) {
      evalMaybeExpr(segment, "contents", "text");
    },
    card(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "title");
    },
  });
  const blockDispatch = {
    field({ field_name, fieldview }) {
      const val = row[field_name];
      let field = fields.find((fld) => fld.name === field_name);
      if (!field && field_name === "id")
        field = new Field({ name: "id", label: "id", type: "Integer" });
      if (!field) return "";
      if (fieldview && field.type === "File") {
        return val
          ? getState().fileviews[fieldview].run(
              val,
              row[`${field_name}__filename`]
            )
          : "";
      } else if (
        fieldview &&
        field.type.fieldviews &&
        field.type.fieldviews[fieldview]
      )
        return field.type.fieldviews[fieldview].run(val, req);
      else return text(val);
    },
    join_field({ join_field }) {
      const [refNm, targetNm] = join_field.split(".");
      const val = row[`${refNm}_${targetNm}`];
      return text(val);
    },
    aggregation({ agg_relation, stat }) {
      const [table, fld] = agg_relation.split(".");
      const targetNm = (stat + "_" + table + "_" + fld).toLowerCase();
      const val = row[targetNm];
      return text(val);
    },
    action({ action_name, confirm }) {
      return post_btn(
        action_url(viewname, table, action_name, row),
        action_name,
        req.csrfToken(),
        { confirm, req }
      );
    },
    view_link(view) {
      const { key } = view_linker(view, fields);
      return key(row);
    },
  };
  return renderLayout({ blockDispatch, layout, role });
};

module.exports = {
  name: "Show",
  get_state_fields,
  configuration_workflow,
  run,
  runMany,
  renderRows,
  initial_config,
  display_state_form: false,
};
