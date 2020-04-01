const Field = require("saltcorn-data/models/field");
const FieldRepeat = require("saltcorn-data/models/fieldrepeat");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const View = require("saltcorn-data/models/view");
const Workflow = require("saltcorn-data/models/workflow");
const { text } = require("saltcorn-markup/tags");
const { renderForm } = require("saltcorn-markup");

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
                    required: true,
                    attributes: {
                      options: fldOptions.join()
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
        form: async context => {
          const table_id = context.table_id;
          const table = await Table.findOne({ id: table_id });
          const fields = await table.getFields();
          const in_form_fields = context.columns.map(f => f.field_name);
          const omitted_fields = fields.filter(
            f => !in_form_fields.includes(f.name)
          );
          const form = new Form({
            blurb: "These fields were missing, you can give values here",
            fields: omitted_fields
          });
          await form.fill_fkey_options();
          return form;
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
    const fldnm = column.field_name;
    if (column.type === "Field") {
      const f = fields.find(fld => fld.name === column.field_name);
      return f;
    }
  });

  const form = new Form({ action: `/view/${viewname}`, fields: tfields });
  await form.fill_fkey_options();
  if (id) form.hidden("id");
  return form;
};

const run = async (table_id, viewname, config, state) => {
  //console.log({config})
  const { columns } = config;
  const table = await Table.findOne({ id: table_id });
  const form = await getForm(table, viewname, columns, state.id);

  if (state.id) {
    const row = await table.getRow({ id: state.id });
    form.values = row;
  }
  return renderForm(form);
};

const runPost = async (table_id, viewname, { columns }, state, body, res) => {
  const table = await Table.findOne({ id: table_id });
  const form = await getForm(table, viewname, columns, body.id);
  form.validate(body);
  if (form.hasErrors) {
    res.sendWrap(`${table.name} create new`, renderForm(form)); // vres.errors.join("\n"));
  } else {
    if (typeof body.id === "undefined") {
      await table.insertRow(form.values);
    } else {
      const id = v.id;
      await table.updateRow(form.values, id);
    }
    res.redirect(`/list/${table.name}`);
  }
};

module.exports = {
  name: "Edit",
  configuration_workflow,
  run,
  runPost,
  get_state_fields,
  display_state_form: false
};
