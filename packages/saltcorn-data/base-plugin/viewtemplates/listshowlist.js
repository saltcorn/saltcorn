const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text, div, h4, h6 } = require("@saltcorn/markup/tags");
const { renderForm, tabs } = require("@saltcorn/markup");
const {
  get_child_views,
  get_parent_views,
  readState,
} = require("../../plugin-helper");
const { splitUniques } = require("./viewable_fields");
const { InvalidConfiguration } = require("../../utils");

const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Views"),
        form: async (context) => {
          const list_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow, viewtemplate }) =>
              viewtemplate.view_quantity === "Many" &&
              viewrow.name !== context.viewname &&
              state_fields.every((sf) => !sf.required)
          );
          const list_view_opts = list_views.map((v) => v.name);
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.some((sf) => sf.name === "id")
          );
          const show_view_opts = show_views.map((v) => v.name);

          return new Form({
            fields: [
              {
                name: "list_view",
                label: req.__("List View"),
                type: "String",
                sublabel: req.__(
                  "A list view shown on the left, to select rows"
                ),
                required: false,
                attributes: {
                  options: list_view_opts,
                },
              },
              {
                name: "show_view",
                label: req.__("Show View"),
                type: "String",
                sublabel: req.__("The view to show the selected row"),
                required: false,
                attributes: {
                  options: show_view_opts,
                },
              },
              {
                name: "_omit_state_form",
                label: req.__("Omit search form"),
                sublabel: req.__("Do not display the search filter form"),
                type: "Bool",
                default: true,
              },
            ],
          });
        },
      },
      {
        name: req.__("Subtables"),
        contextField: "subtables",
        form: async (context) => {
          const tbl = await Table.findOne({ id: context.table_id });
          var fields = [];
          const child_views = await get_child_views(tbl, context.viewname);
          for (const { relation, related_table, views } of child_views) {
            for (const view of views) {
              fields.push({
                name: `ChildList:${view.name}.${related_table.name}.${relation.name}`,
                label: `${view.name} of ${relation.label} on ${related_table.name}`,
                type: "Bool",
              });
            }
          }
          const parent_views = await get_parent_views(tbl, context.viewname);
          for (const { relation, related_table, views } of parent_views) {
            for (const view of views) {
              fields.push({
                name: `ParentShow:${view.name}.${related_table.name}.${relation.name}`,
                label: `${view.name} of ${relation.name} on ${related_table.name}`,
                type: "Bool",
              });
            }
          }
          return new Form({
            fields,
            blurb: req.__(
              "Which related tables would you like to show in sub-lists below the selected item?"
            ),
          });
        },
      },
    ],
  });

const get_state_fields = async (
  table_id,
  viewname,
  { list_view, show_view }
) => {
  const id = {
    name: "id",
    type: "Integer",
    required: false,
  };
  if (list_view) {
    const lview = await View.findOne({ name: list_view });
    if (lview) {
      const lview_sfs = await lview.get_state_fields();
      return [id, ...lview_sfs];
    } else return [id];
  } else return [id];
};

const run = async (
  table_id,
  viewname,
  { list_view, show_view, subtables },
  state,
  extraArgs
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  readState(state, fields);

  var lresp;
  if (list_view) {
    const lview = await View.findOne({ name: list_view });
    if (!lview)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find view ${list_view}`
      );
    const state1 = lview.combine_state_and_default_state(state);
    lresp = await lview.run(state1, {
      ...extraArgs,
      onRowSelect: (v) => `select_id(${v.id})`,
    });
  }

  var sresp = "";
  if (show_view) {
    const sview = await View.findOne({ name: show_view });
    if (!sview)
      throw new InvalidConfiguration(
        `View ${viewname} incorrectly configured: cannot find view ${show_view}`
      );
    sresp = await sview.run(state, extraArgs);
  }
  var reltbls = {};
  var myrow;
  const { uniques } = splitUniques(fields, state, true);

  if (Object.keys(uniques).length > 0) {
    var id;
    if (state.id) id = state.id;
    else {
      myrow = await table.getRow(uniques);
      if (!myrow) return `Not found`;
      id = myrow.id;
    }
    for (const relspec of Object.keys(subtables || {})) {
      if (subtables[relspec]) {
        const [reltype, rel] = relspec.split(":");
        switch (reltype) {
          case "ChildList":
            const [vname, reltblnm, relfld] = rel.split(".");
            const tab_name = reltblnm;
            const subview = await View.findOne({ name: vname });
            if (!subview)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find view ${vname}`
              );
            else {
              const subresp = await subview.run({ [relfld]: id }, extraArgs);
              reltbls[tab_name] = subresp;
            }
            break;
          case "ParentShow":
            const [pvname, preltblnm, prelfld] = rel.split(".");
            if (!myrow) myrow = await table.getRow({ id });
            if (!myrow) continue;
            const ptab_name = prelfld;
            const psubview = await View.findOne({ name: pvname });
            if (!psubview)
              throw new InvalidConfiguration(
                `View ${viewname} incorrectly configured: cannot find view ${pvname}`
              );
            else {
              const psubresp = await psubview.run(
                { id: myrow[prelfld] },
                extraArgs
              );

              reltbls[ptab_name] = psubresp;
            }
            break;
          default:
            break;
        }
      }
    }
  }
  const relTblResp =
    Object.keys(reltbls).length === 1
      ? [h6(Object.keys(reltbls)[0]), reltbls[Object.keys(reltbls)[0]]]
      : tabs(reltbls);
  if (lresp) {
    return div(
      { class: "row" },
      div({ class: "col-sm-6" }, lresp),
      div({ class: "col-sm-6" }, sresp, relTblResp)
    );
  } else {
    return div(sresp, relTblResp);
  }
};

module.exports = {
  name: "ListShowList",
  description:
    "Combine an optional list view on the left with displays on the right of a single selected row, with views of related rows from different tables underneath",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: ({ list_view, _omit_state_form }) =>
    !!list_view && !_omit_state_form,
};
