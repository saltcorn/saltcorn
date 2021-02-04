const Form = require("../../models/form");
const User = require("../../models/user");
const Field = require("../../models/field");
const View = require("../../models/view");
const File = require("../../models/file");
const Table = require("../../models/table");
const Page = require("../../models/page");
const Workflow = require("../../models/workflow");
const { post_btn, link } = require("@saltcorn/markup");
const { getState } = require("../../db/state");
const { eachView } = require("../../models/layout");

const { div, text, span, a, text_attr, i } = require("@saltcorn/markup/tags");
const renderLayout = require("@saltcorn/markup/layout");

const {
  stateFieldsToWhere,
  stateFieldsToQuery,
  get_link_view_opts,
  picked_fields_to_query,
  initial_config_all_fields,
  calcfldViewOptions,
  calcfldViewConfig,
  getActionConfigFields,
} = require("../../plugin-helper");
const {
  action_url,
  view_linker,
  parse_view_select,
  action_link,
} = require("./viewable_fields");
const db = require("../../db");
const { asyncMap, structuredClone } = require("../../utils");
const { traverseSync } = require("../../models/layout");
const { get_expression_function } = require("../../models/expression");

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
          const stateActions = getState().actions;
          const actions = [
            "Delete",
            ...boolfields.map((f) => `Toggle ${f.name}`),
            ...Object.keys(stateActions),
          ];
          const actionConfigForms = {};
          for (const [name, action] of Object.entries(stateActions)) {
            if (action.configFields) {
              actionConfigForms[name] = await getActionConfigFields(
                action,
                table
              );
            }
          }
          const fieldViewConfigForms = await calcfldViewConfig(fields, false);
          const field_view_options = calcfldViewOptions(fields, false);

          const link_view_opts = await get_link_view_opts(
            table,
            context.viewname
          );
          const roles = await User.get_roles();
          const { parent_field_list } = await table.get_parent_relations(true);
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
          const views = link_view_opts;
          const pages = await Page.find();
          const images = await File.find({ mime_super: "image" });
          return {
            fields,
            images,
            actions,
            actionConfigForms,
            fieldViewConfigForms,
            field_view_options,
            link_view_opts,
            parent_field_list,
            child_field_list,
            agg_field_opts,
            roles,
            views,
            pages,
            mode: "show",
            ownership: !!table.ownership_field_id || table.name === "users",
          };
        },
      },
      {
        name: req.__("Set page title"),
        form: () =>
          new Form({
            blurb: req.__(
              "Skip this section if you do not want to set the page title"
            ),
            fields: [
              {
                name: "page_title",
                label: req.__("Page title"),
                type: "String",
              },
              {
                name: "page_title_formula",
                label: req.__("Page title is a formula?"),
                type: "Bool",
                required: false,
              },
            ],
          }),
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

const run = async (
  table_id,
  viewname,
  { columns, layout, page_title, page_title_formula },
  state,
  extra
) => {
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
  const rendered = (
    await renderRows(tbl, viewname, { columns, layout }, extra, rows)
  )[0];
  let page_title_preamble = "";
  if (page_title) {
    let the_title = page_title;
    if (page_title_formula) {
      const f = get_expression_function(page_title, fields);
      the_title = f(rows[0]);
    }
    page_title_preamble = `<!--SCPT:${text_attr(the_title)}-->`;
  }
  return page_title_preamble + rendered;
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
    const view_select = parse_view_select(nm);
    const view = await View.findOne({ name: view_select.viewname });
    if (!view) return false;
    if (view.table_id === table.id) view.table = table;
    else view.table = await Table.findOne({ id: view.table_id });
    view.view_select = view_select;
    views[nm] = view;
    return view;
  };
  const owner_field = await table.owner_fieldname();
  return await asyncMap(rows, async (row) => {
    await eachView(layout, async (segment) => {
      const view = await getView(segment.view);
      if (!view)
        segment.contents = `View ${viewname} incorrectly configured: cannot find view ${segment.view}`;
      else if (
        view.viewtemplateObj.renderRows &&
        view.view_select.type === "Own"
      ) {
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
        let state;
        switch (view.view_select.type) {
          case "Own":
            state = { id: row.id };
            break;
          case "ChildList":
            state = { [view.view_select.field_name]: row.id };
            break;
          case "ParentShow":
            state = { id: row[view.view_select.field_name] };
            break;
        }
        segment.contents = await view.run(state, extra);
      }
    });
    return render(
      row,
      fields,
      layout,
      viewname,
      table,
      role,
      extra.req,
      owner_field
    );
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
    ...(extra && extra.offset && { offset: extra.offset }),
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

const render = (
  row,
  fields,
  layout0,
  viewname,
  table,
  role,
  req,
  owner_field
) => {
  const user_id = req.user ? req.user.id : null;
  const is_owner = owner_field && user_id && row[owner_field] === user_id;
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
    view_link(segment) {
      evalMaybeExpr(segment, "view_label", "label");
    },
    blank(segment) {
      evalMaybeExpr(segment, "contents", "text");
    },
    action(segment) {
      evalMaybeExpr(segment, "action_label");
    },
    card(segment) {
      evalMaybeExpr(segment, "url");
      evalMaybeExpr(segment, "title");
    },
    container(segment) {
      evalMaybeExpr(segment, "bgColor");
      evalMaybeExpr(segment, "customClass");

      if (segment.showIfFormula) {
        const f = get_expression_function(segment.showIfFormula, fields);
        if (!f(row)) segment.hide = true;
      }
    },
  });
  const blockDispatch = {
    field({ field_name, fieldview, configuration }) {
      const val = row[field_name];
      let field = fields.find((fld) => fld.name === field_name);
      if (!field && field_name === "id")
        field = new Field({ name: "id", label: "id", type: "Integer" });
      if (!field) return "";
      if (fieldview && field.type === "File") {
        return val
          ? getState().fileviews[fieldview].run(
              val,
              row[`${field_name}__filename`],
              configuration
            )
          : "";
      } else if (
        fieldview &&
        field.type.fieldviews &&
        field.type.fieldviews[fieldview]
      )
        return field.type.fieldviews[fieldview].run(val, req, configuration);
      else return text(val);
    },
    join_field({ join_field }) {
      const keypath = join_field.split(".");
      if (keypath.length === 2) {
        const [refNm, targetNm] = keypath;
        return text(row[`${refNm}_${targetNm}`]);
      } else {
        const [refNm, through, targetNm] = keypath;
        return text(row[`${refNm}_${through}_${targetNm}`]);
      }
    },
    aggregation({ agg_relation, stat }) {
      const [table, fld] = agg_relation.split(".");
      const targetNm = (stat + "_" + table + "_" + fld).toLowerCase();
      const val = row[targetNm];
      return text(val);
    },
    action(segment) {
      const url = action_url(
        viewname,
        table,
        segment.action_name,
        row,
        segment.rndid,
        "rndid"
      );
      return action_link(url, req, segment);
    },
    view_link(view) {
      const { key } = view_linker(view, fields);
      return key(row);
    },
  };
  return renderLayout({
    blockDispatch,
    layout,
    role,
    is_owner,
  });
};
const run_action = async (
  table_id,
  viewname,
  { columns, layout },
  body,
  { req, res }
) => {
  const col = columns.find(
    (c) => c.type === "Action" && c.rndid === body.rndid && body.rndid
  );
  const table = await Table.findOne({ id: table_id });
  const row = await table.getRow({ id: body.id });
  const state_action = getState().actions[col.action_name];
  try {
    const result = await state_action.run({
      configuration: col.configuration,
      table,
      row,
      user: req.user,
    });
    return { json: { success: "ok", ...(result || {}) } };
  } catch (e) {
    return { json: { error: e.message || e } };
  }
};

module.exports = {
  name: "Show",
  description: "Show a single row, with flexible layout",
  get_state_fields,
  configuration_workflow,
  run,
  runMany,
  renderRows,
  initial_config,
  display_state_form: false,
  routes: { run_action },
};
