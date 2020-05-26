const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text, div, h4 } = require("@saltcorn/markup/tags");
const { renderForm, tabs } = require("@saltcorn/markup");
const { mkTable } = require("@saltcorn/markup");
const { get_child_views, get_parent_views } = require("../../plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async context => {
          const list_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow, viewtemplate }) =>
              viewtemplate.view_quantity === "Many" &&
              viewrow.name !== context.viewname &&
              state_fields.every(sf => !sf.required)
          );
          const list_view_opts = list_views.map(v => v.name);
          const show_views = await View.find_table_views_where(
            context.table_id,
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              state_fields.some(sf => sf.name === "id")
          );
          const show_view_opts = show_views.map(v => v.name);

          return new Form({
            fields: [
              {
                name: "list_view",
                label: "List View",
                type: "String",
                required: false,
                attributes: {
                  options: list_view_opts.join()
                }
              },
              {
                name: "show_view",
                label: "Show View",
                type: "String",
                required: false,
                attributes: {
                  options: show_view_opts.join()
                }
              }
            ]
          });
        }
      },
      {
        name: "subtables",
        contextField: "subtables",
        form: async context => {
          const tbl = await Table.findOne({ id: context.table_id });
          var fields = [];
          const child_views = await get_child_views(tbl, context.viewname);
          for (const { relation, related_table, views } of child_views) {
            for (const view of views) {
              fields.push({
                name: `ChildList:${view.name}.${related_table.name}.${relation.name}`,
                label: `${view.name} of ${relation.label} on ${related_table.name}`,
                type: "Bool"
              });
            }
          }
          const parent_views = await get_parent_views(tbl, context.viewname);
          for (const { relation, related_table, views } of parent_views) {
            for (const view of views) {
              fields.push({
                name: `ParentShow:${view.name}.${related_table.name}.${relation.name}`,
                label: `${view.name} of ${relation.name} on ${related_table.name}`,
                type: "Bool"
              });
            }
          }
          return new Form({
            fields,
            blurb:
              "Which related tables would you like to show in sub-lists below the selected item?"
          });
        }
      }
    ]
  });

const get_state_fields = async (
  table_id,
  viewname,
  { list_view, show_view }
) => {
  const id = {
    name: "id",
    type: "Integer",
    required: false
  };
  if (list_view) {
    const lview = await View.findOne({ name: list_view });
    const lview_sfs = await lview.get_state_fields();
    return [id, ...lview_sfs];
  } else return [id];
};

const run = async (
  table_id,
  viewname,
  { list_view, show_view, subtables },
  state,
  extraArgs
) => {
  var lresp;
  if(list_view) {
    const lview = await View.findOne({ name: list_view });
    lresp = await lview.run(state, {
      ...extraArgs,
      onRowSelect: v => `select_id(${v.id})`
    });
  }

  var sresp = "";
  if (show_view) {
    const sview = await View.findOne({ name: show_view });
    sresp = await sview.run(state, extraArgs);
  }
  var reltbls = {};
  var myrow;
  if (state.id) {
    const id = state.id;
    for (const relspec of Object.keys(subtables || {})) {
      if (subtables[relspec]) {
        const [reltype, rel] = relspec.split(":");
        switch (reltype) {
          case "ChildList":
            const [vname, reltblnm, relfld] = rel.split(".");
            const subview = await View.findOne({ name: vname });
            const subresp = await subview.run({ [relfld]: id }, extraArgs);

            const tab_name = reltblnm;
            reltbls[tab_name] = subresp;
            break;
          case "ParentShow":
            const [pvname, preltblnm, prelfld] = rel.split(".");
            const psubview = await View.findOne({ name: pvname });
            if (!myrow) {
              const mytable = await Table.findOne({ id: table_id });
              myrow = await mytable.getRow({ id });
            }
            const psubresp = await psubview.run(
              { id: myrow[prelfld] },
              extraArgs
            );

            const ptab_name = prelfld;
            reltbls[ptab_name] = psubresp;
            break;
          default:
            break;
        }
      }
    }
  }
  const relTblResp = Object.keys(reltbls).length===1 ? reltbls[Object.keys(reltbls)[0]] : tabs(reltbls)
  if(lresp) {
    return div(
      { class: "row" },
      div({ class: "col-sm-6" }, lresp),
      div({ class: "col-sm-6" }, sresp, relTblResp)
    );
  } else {
    return div( sresp, relTblResp );
  }
};

module.exports = {
  name: "ListShowList",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: true
};
