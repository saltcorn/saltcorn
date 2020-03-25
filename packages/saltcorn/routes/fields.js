const Router = require("express-promise-router");

const db = require("saltcorn-data/db");
const State = require("saltcorn-data/db/state");
const { renderForm } = require("saltcorn-markup");
const Field = require("saltcorn-data/models/field");
const Table = require("saltcorn-data/models/table");
const Form = require("saltcorn-data/models/form");
const Workflow = require("saltcorn-data/models/workflow");

const { sqlsanitize, fkeyPrefix, isAdmin } = require("./utils.js");

const router = new Router();
module.exports = router;

const fieldForm = fkey_opts =>
  new Form({
    action: "/field",
    fields: [
      new Field({ label: "Name", name: "name", input_type: "text" }),
      new Field({ label: "Label", name: "label", input_type: "text" }),
      new Field({
        label: "Type",
        name: "type",
        input_type: "select",
        options: State.type_names.concat(fkey_opts || [])
      }),
      new Field({
        label: "Required",
        name: "required",
        type: State.types["Bool"]
      })
    ]
  });

const fieldFlow = new Workflow({
  action: "/field",
  onDone: async context => {
    const type = State.types[context.type];
    var attributes = {};
    if (!new Field(context).is_fkey)
      type.attributes.forEach(a => {
        attributes[a.name] = context[a.name];
      });

    attributes.default = context.default;
    attributes.summary_field = context.summary_field;
    if (context.id) {
      const { table_id, name, label, type, required } = context;
      await db.update(
        "fields",
        { table_id, name, label, type, required, attributes },
        context.id
      );
    } else await Field.create({ attributes, ...context });
    return { redirect: `/table/${context.table_id}` };
  },
  steps: [
    {
      name: "field",
      form: async () => {
        const tables = await Table.find({});
        const fkey_opts = tables.map(t => fkeyPrefix + t.name);
        return fieldForm(fkey_opts);
      }
    },
    {
      name: "attributes",
      onlyWhen: context => {
        if (new Field(context).is_fkey) return false;
        const type = State.types[context.type];
        return type.attributes && type.attributes.length > 0;
      },
      form: context => {
        const type = State.types[context.type];
        return new Form({
          fields: type.attributes
        });
      }
    },
    {
      name: "summary",
      onlyWhen: context => new Field(context).is_fkey,
      form: async context => {
        const fld = new Field(context);
        const table = await Table.findOne({ name: fld.reftable });
        const fields = await Field.find({ table_id: table.id });
        const keyfields = fields.map(f => ({ value: f.name, label: f.label }));
        return new Form({
          fields: [
            new Field({
              name: "summary_field",
              label: "Summary field",
              input_type: "select",
              options: keyfields
            })
          ]
        });
      }
    },
    {
      name: "default",
      onlyWhen: async context => {
        if (!context.required || context.id) return false;
        const table = await Table.findOne({id:context.table_id});
        const rows = await db.select(table.name); //todo count
        return rows.length > 0;
      },
      form: async context => {
        const formfield = new Field({
          name: "default",
          label: "Default",
          type: context.type,
          attributes: { summary_field: context.summary_field }
        });
        await formfield.fill_fkey_options();
        return new Form({
          fields: [formfield]
        });
      }
    }
  ]
});
router.get("/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const field = await db.get_field_by_id(id);
  const wfres = await fieldFlow.run({ ...field, ...field.attributes });
  res.sendWrap(`Edit field`, renderForm(wfres.renderForm));
});

router.get("/new/:table_id", isAdmin, async (req, res) => {
  const wfres = await fieldFlow.run(req.params);
  res.sendWrap(`New field`, renderForm(wfres.renderForm));
});

router.post("/delete/:id", isAdmin, async (req, res) => {
  const { id } = req.params;

  const {
    rows
  } = await db.query("delete FROM fields WHERE id = $1 returning *", [id]);

  const table = await Table.findOne({id:rows[0].table_id});
  await db.query(
    `alter table ${sqlsanitize(table.name)} drop column ${sqlsanitize(
      rows[0].name
    )}`
  );

  res.redirect(`/table/${rows[0].table_id}`);
});

router.post("/", isAdmin, async (req, res) => {
  const wfres = await fieldFlow.run(req.body);
  if (wfres.renderForm)
    res.sendWrap(`Field attributes`, renderForm(wfres.renderForm));
  else res.redirect(wfres.redirect);
});
