const Field = require("../../models/field");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text } = require("saltcorn-markup/tags");
const { renderForm } = require("saltcorn-markup");
const { initial_config_all_fields } = require("../../plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "editfields",
        form: async context => {
          const table_id = context.table_id;
          const table = await Table.findOne({ id: table_id });
          const fields = await table.getFields();
          const fldOptions = fields.map(f => text(f.name));
          var fldViewOptions = {};
          fields.forEach(f => {
            if (f.type && f.type.fieldviews) {
              fldViewOptions[f.name] = []
              Object.entries(f.type.fieldviews).forEach(([nm,fv])=>{
                if(fv.isEdit) 
                fldViewOptions[f.name].push(nm)
            })
          }
          });
          return new Form({
            blurb:
              "Finalise your edit view by specifying the fields in the table",
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
                      //TODO omit when no options
                      options: [
                        {
                          name: "Field",
                          label: `Field in ${table.name} table`
                        },
                        { name: "Static", label: "Fixed content" }
                      ]
                    }
                  },
                  {
                    name: "field_name",
                    label: "Field",
                    type: "String",
                    class: "field_name",
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
                    name: "static_type",
                    label: "Field",
                    type: "String",
                    required: true,
                    attributes: {
                      options: "Section header, Paragraph"
                    },
                    showIf: { ".coltype": "Static" }
                  }
                ]
              })
            ]
          });
        }
      },
      {
        name: "fixed_fields",
        contextField: "fixed",
        onlyWhen: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const in_form_fields = context.columns.map(f => f.field_name);
          return fields.some(f => !in_form_fields.includes(f.name));
        },
        form: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const in_form_fields = context.columns.map(f => f.field_name);
          const omitted_fields = fields.filter(
            f => !in_form_fields.includes(f.name)
          );
          var formFields = [];
          omitted_fields.forEach(f => {
            if (f.presets) {
              f.required = false;
            }
            formFields.push(f);
            if (f.presets) {
              formFields.push(
                new Field({
                  name: "preset_" + f.name,
                  label: "Preset " + f.label,
                  type: "String",
                  attributes: { options: Object.keys(f.presets).join() }
                })
              );
            }
          });
          const form = new Form({
            blurb: "These fields were missing, you can give values here",
            fields: formFields
          });
          await form.fill_fkey_options();
          return form;
        }
      },
      {
        name: "editoptions",
        form: async context => {
          const done_views = await View.find_all_views_where(
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              (viewrow.table_id === context.table_id ||
                state_fields.every(sf => !sf.required))
          );
          const done_view_opts = done_views.map(v => v.name);

          return new Form({
            fields: [
              {
                name: "view_when_done",
                label: "View when done",
                type: "String",
                required: true,
                attributes: {
                  options: done_view_opts.join()
                }
              }
            ]
          });
        }
      }
    ]
  });
const get_state_fields = async (table_id, viewname, { columns }) => [
  {
    name: "id",
    type: "Integer"
  }
];

const getForm = async (table, viewname, columns, id) => {
  const fields = await Field.find({ table_id: table.id });

  const tfields = columns.map(column => {
    if (column.type === "Field") {
      const f = fields.find(fld => fld.name === column.field_name);
      f.fieldview = column.fieldview
      return f;
    }
  });

  const form = new Form({ action: `/view/${viewname}`, fields: tfields });
  await form.fill_fkey_options();
  if (id) form.hidden("id");
  return form;
};

const initial_config = initial_config_all_fields(true);

const run = async (table_id, viewname, config, state) => {
  //console.log({config})
  const { columns } = config;
  const table = await Table.findOne({ id: table_id });
  const form = await getForm(table, viewname, columns, state.id);

  if (state.id) {
    const row = await table.getRow({ id: state.id });
    form.values = row;
  }
  Object.entries(state).forEach(([k, v]) => {
    if (k !== "id") {
      const field = form.fields.find(f => f.name === k);
      if (field && field.type && field.type.read) {
        form.values[k] = field.type.read(v);
        field.input_type = "hidden";
      }
    }
  });
  return renderForm(form);
};

const fill_presets = async (table, req, fixed) => {
  const fields = await table.getFields();
  Object.keys(fixed || {}).forEach(k => {
    if (k.startsWith("preset_")) {
      if (fixed[k]) {
        const fldnm = k.replace("preset_", "");
        const fld = fields.find(f => f.name === fldnm);
        fixed[fldnm] = fld.presets[fixed[k]]({ user: req.user });
      }
      delete fixed[k];
    }
  });
  return fixed;
};

const runPost = async (
  table_id,
  viewname,
  { columns, fixed, view_when_done },
  state,
  body,
  { res, req }
) => {
  const table = await Table.findOne({ id: table_id });
  const form = await getForm(table, viewname, columns, body.id);
  form.validate(body);
  if (form.hasErrors) {
    res.sendWrap(`${table.name} create new`, renderForm(form));
  } else {
    const use_fixed = await fill_presets(table, req, fixed);
    const row = { ...use_fixed, ...form.values };
    var id = body.id;
    if (typeof id === "undefined") {
      id = await table.insertRow(row);
    } else {
      await table.updateRow(row, parseInt(id));
    }
    const nxview = await View.findOne({ name: view_when_done });
    //console.log()
    const state_fields = await nxview.get_state_fields();
    if (
      nxview.table_id === table_id &&
      state_fields.some(sf => sf.name === "id")
    )
      res.redirect(`/view/${text(view_when_done)}?id=${text(id)}`);
    else res.redirect(`/view/${text(view_when_done)}`);
  }
};

module.exports = {
  name: "Edit",
  configuration_workflow,
  run,
  runPost,
  get_state_fields,
  initial_config,
  display_state_form: false
};
