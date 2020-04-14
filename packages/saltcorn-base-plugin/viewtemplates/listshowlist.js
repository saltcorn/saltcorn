const Field = require("saltcorn-data/models/field");
const FieldRepeat = require("saltcorn-data/models/fieldrepeat");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const View = require("saltcorn-data/models/view");
const Workflow = require("saltcorn-data/models/workflow");
const { text, div, h4 } = require("saltcorn-markup/tags");
const { renderForm, tabs } = require("saltcorn-markup");
const { mkTable } = require("saltcorn-markup");

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
                required: true,
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
          const rels = await Field.find({ type: `Key to ${tbl.name}` });
          var fields = [];
          for (const rel of rels) {
            const reltbl = await Table.findOne({ id: rel.table_id });
            fields.push({
              name: `${reltbl.name}.${rel.name}`,
              label: `${rel.label} on ${reltbl.name}`,
              type: "Bool"
            });
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
  const sview = await View.findOne({ name: show_view });
  const lview_sfs = await lview.get_state_fields();
  const sview_sfs = await sview.get_state_fields();
  return [...lview_sfs, ...sview_sfs];
};

const run = async (
  table_id,
  viewname,
  { list_view, show_view, subtables },
  state
) => {
  const lview = await View.findOne({ name: list_view });
  const sview = await View.findOne({ name: show_view });
  const lresp = await lview.run(state, {
    onRowSelect: v => `select_id(${v.id})`
  });
  const sresp = await sview.run(state);

  var reltbls = {};
  if (state.id) {
    const id = state.id;
    for (const rel of Object.keys(subtables || {})) {
      if (subtables[rel]) {
        const [reltblnm, relfld] = rel.split(".");
        const reltbl = await Table.findOne({ name: reltblnm });
        const rows = await reltbl.getJoinedRows({
          where: {
            [relfld]: id
          }
        });
        const relfields = await reltbl.getFields();
        const trfields = relfields.map(f => ({
          label: f.label,
          key: f.listKey
        }));
        const tab_name = `${relfld} on ${reltbl.name}`;
        reltbls[tab_name] = mkTable(trfields, rows);
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
