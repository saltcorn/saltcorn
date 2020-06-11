const Router = require("express-promise-router");

const { getState } = require("@saltcorn/data/db/state");
const { renderForm } = require("@saltcorn/markup");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");

const { setTenant, isAdmin } = require("./utils.js");

const router = new Router();
module.exports = router;

const fieldForm = fkey_opts =>
  new Form({
    action: "/field",
    fields: [
      new Field({ label: "Label", name: "label", input_type: "text" }),
      new Field({
        label: "Type",
        name: "type",
        input_type: "select",
        options: getState().type_names.concat(fkey_opts || [])
      }),
      new Field({
        label: "Required",
        name: "required",
        type: getState().types["Bool"]
      }),
      new Field({
        label: "Unique",
        name: "is_unique",
        type: getState().types["Bool"]
      })
    ]
  });

const calcFieldType = ctxType =>
  ctxType.startsWith("Key to")
    ? { type: "Key", reftable_name: ctxType.replace("Key to ", "") }
    : { type: ctxType };

const fieldFlow = new Workflow({
  action: "/field",
  onDone: async context => {
    const thetype = getState().types[context.type];
    var attributes = context.attributes || {};
    attributes.default = context.default;
    attributes.summary_field = context.summary_field;
    const { table_id, name, label, required, is_unique } = context;
    const { reftable_name, type } = calcFieldType(context.type);
    const fldRow = {
      table_id,
      name,
      label,
      type,
      required,
      is_unique,
      reftable_name,
      attributes
    };
    if (context.id) {
      await Field.update(fldRow, context.id);
    } else await Field.create(fldRow);
    return { redirect: `/table/${context.table_id}` };
  },
  steps: [
    {
      name: "field",
      form: async context => {
        const tables = await Table.find({});
        const fkey_opts = [
          ...tables.map(t => `Key to ${t.name}`),
          "Key to users",
          "File"
        ];
        const form = fieldForm(fkey_opts);
        if (context.type === "Key" && context.reftable_name) {
          form.values.type = `Key to ${context.reftable_name}`;
        }
        return form;
      }
    },
    {
      name: "attributes",
      contextField: "attributes",
      onlyWhen: context => {
        if (context.type === "File") return true;
        if (new Field(context).is_fkey) return false;
        const type = getState().types[context.type];
        return type.attributes && type.attributes.length > 0;
      },
      form: async context => {
        if (context.type === "File") {
          const roles = await User.get_roles();
          return new Form({
            fields: [
              {
                name: "min_role_read",
                label: "Role required to access added files",
                sublabel:
                  "The user uploading the file has access irrespective of their role",
                input_type: "select",
                options: roles.map(r => ({ value: r.id, label: r.role }))
              }
            ]
          });
        } else {
          return new Form({
            fields: getState().types[context.type].attributes
          });
        }
      }
    },
    {
      name: "summary",
      onlyWhen: context =>
        context.type !== "Key to users" &&
        context.type !== "File" &&
        new Field(context).is_fkey,
      form: async context => {
        const fld = new Field(context);
        const table = await Table.findOne({ name: fld.reftable_name });
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
        if (context.type === "Key to users") context.summary_field = "email";
        if (!context.required || context.id) return false;
        const table = await Table.findOne({ id: context.table_id });
        const nrows = await table.countRows();
        return nrows > 0;
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
router.get("/:id", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;
  const field = await Field.findOne({ id });
  const wfres = await fieldFlow.run({ ...field.toJson, ...field.attributes });
  res.sendWrap(`Edit field`, renderForm(wfres.renderForm, req.csrfToken()));
});

router.get("/new/:table_id", setTenant, isAdmin, async (req, res) => {
  const wfres = await fieldFlow.run(req.params);
  res.sendWrap(`New field`, renderForm(wfres.renderForm, req.csrfToken()));
});

router.post("/delete/:id", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;
  const f = await Field.findOne({ id });
  const table_id = f.table_id;

  await f.delete();

  res.redirect(`/table/${table_id}`);
});

router.post("/", setTenant, isAdmin, async (req, res) => {
  const wfres = await fieldFlow.run(req.body);
  if (wfres.renderForm)
    res.sendWrap(`Field attributes`, renderForm(wfres.renderForm, req.csrfToken()));
  else res.redirect(wfres.redirect);
});
