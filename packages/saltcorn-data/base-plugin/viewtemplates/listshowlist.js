const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text, div, h4 } = require("saltcorn-markup/tags");
const { renderForm, tabs } = require("saltcorn-markup");
const { mkTable } = require("saltcorn-markup");
const { get_child_views } = require("../../plugin-helper");

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
                required: true,
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
          const child_views = await get_child_views(tbl);
          console.log({ child_views });
          for (const { rel, reltbl, views } of child_views) {
            for (const view of views) {
              fields.push({
                name: `ChildList:${view.name}.${reltbl.name}.${rel.name}`,
                label: `${view.name} of ${rel.label} on ${reltbl.name}`,
                type: "Bool"
              });
            }
          }
          const parentrels = (await tbl.getFields()).filter(f => f.is_fkey);
          for (const parentrel of parentrels) {
            const partable = await Table.findOne({
              name: parentrel.reftable_name
            });
            const parent_show_views = await View.find_table_views_where(
              partable.id,
              ({ state_fields, viewrow }) =>
                viewrow.name !== context.viewname &&
                state_fields.some(sf => sf.name === "id")
            );
            for (const view of parent_show_views) {
              fields.push({
                name: `ParentShow:${view.name}.${partable.name}.${parentrel.name}`,
                label: `${view.name} of ${parentrel.name} on ${partable.name}`,
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
  const lview = await View.findOne({ name: list_view });
  const lview_sfs = await lview.get_state_fields();
  var sview_sfs = [];
  if (show_view) {
    const sview = await View.findOne({ name: show_view });
    sview_sfs = await await sview.get_state_fields();
  }
  return [...lview_sfs, ...sview_sfs];
};

const run = async (
  table_id,
  viewname,
  { list_view, show_view, subtables },
  state,
  extraArgs
) => {
  const lview = await View.findOne({ name: list_view });
  const lresp = await lview.run(state, {
    ...extraArgs,
    onRowSelect: v => `select_id(${v.id})`
  });

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

  return div(
    { class: "row" },
    div({ class: "col-sm-6" }, lresp),
    div({ class: "col-sm-6" }, sresp, tabs(reltbls))
  );
};

module.exports = {
  name: "ListShowList",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: true
};
