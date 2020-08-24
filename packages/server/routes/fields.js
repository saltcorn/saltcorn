const Router = require("express-promise-router");

const { getState } = require("@saltcorn/data/db/state");
const { renderForm } = require("@saltcorn/markup");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");
const db = require("@saltcorn/data/db");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const { disable } = require("contractis/contract");
const { table } = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

const fieldForm = (fkey_opts, existing_names, id) =>
  new Form({
    action: "/field",
    fields: [
      new Field({
        label: "Label",
        name: "label",
        input_type: "text",
        validator(s) {
          if (s.toLowerCase() === "id")
            return `Column '${s}' already exists (but is hidden)`;
          if (!id && existing_names.includes(Field.labelToName(s)))
            return `Column '${s}' already exists`;
        }
      }),
      new Field({
        label: "Type",
        name: "type",
        input_type: "select",
        options: getState().type_names.concat(fkey_opts || []),
        disabled: !!id && !getState().getConfig("development_mode", false)
      }),
      new Field({
        label: "Required",
        name: "required",
        type: getState().types["Bool"],
        disabled: !!id && db.isSQLite
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
      const field = await Field.findOne({ id: context.id });
      try {
        await field.update(fldRow);
      } catch (e) {
        return {
          redirect: `/table/${context.table_id}`,
          flash: ["error", e.message]
        };
      }
    } else {
      try {
        await Field.create(fldRow);
      } catch (e) {
        return {
          redirect: `/table/${context.table_id}`,
          flash: ["error", e.message]
        };
      }
    }

    return {
      redirect: `/table/${context.table_id}`,
      flash: ["success", `Field "${label}" ${context.id ? "saved" : "created"}`]
    };
  },
  steps: [
    {
      name: "Basic properties",
      form: async context => {
        const tables = await Table.find({});
        const table = tables.find(t => t.id === context.table_id);
        const existing_fields = await table.getFields();
        const existingNames = existing_fields.map(f => f.name);
        const fkey_opts = [
          ...tables.map(t => `Key to ${t.name}`),
          "Key to users",
          "File"
        ];
        const form = fieldForm(fkey_opts, existingNames, context.id);
        if (context.type === "Key" && context.reftable_name) {
          form.values.type = `Key to ${context.reftable_name}`;
        }
        return form;
      }
    },
    {
      name: "Attributes",
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
      name: "Summary",
      onlyWhen: context =>
        context.type !== "Key to users" &&
        context.reftable_name !== "users" &&
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
      name: "Default",
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
          required: true,
          attributes: {
            summary_field: context.summary_field,
            ...(context.attributes || {})
          }
        });
        await formfield.fill_fkey_options();
        return new Form({
          fields: [formfield]
        });
      }
    }
  ]
});
router.get(
  "/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const field = await Field.findOne({ id });
    const table = await Table.findOne({ id: field.table_id });
    const wfres = await fieldFlow.run({ ...field.toJson, ...field.attributes });
    res.sendWrap(`Edit field`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: "Tables", href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: `Edit ${field.label} field` },
            { text: wfres.stepName }
          ]
        },
        {
          type: "card",
          title: `${field.label}: ${wfres.stepName} (step ${wfres.currentStep} / max ${wfres.maxSteps})`,
          contents: renderForm(wfres.renderForm, req.csrfToken())
        }
      ]
    });
  })
);

router.get(
  "/new/:table_id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { table_id } = req.params;
    const table = await Table.findOne({ id: table_id });

    const wfres = await fieldFlow.run({ table_id: +table_id });
    res.sendWrap(`New field`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: "Tables", href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: `Add field` },
            { text: wfres.stepName }
          ]
        },
        {
          type: "card",
          title: `New field: ${wfres.stepName} (step ${wfres.currentStep} / max ${wfres.maxSteps})`,
          contents: renderForm(wfres.renderForm, req.csrfToken())
        }
      ]
    });
  })
);

router.post(
  "/delete/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const f = await Field.findOne({ id });
    const table_id = f.table_id;

    await f.delete();
    req.flash("success", `Field "${f.label}" deleted`);
    res.redirect(`/table/${table_id}`);
  })
);

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wfres = await fieldFlow.run(req.body);
    if (wfres.renderForm) {
      const table = await Table.findOne({ id: wfres.context.table_id });
      res.sendWrap(`Field attributes`, {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: "Tables", href: "/table" },
              { href: `/table/${table.id}`, text: table.name },
              { text: `Edit ${wfres.context.label || "new"} field` },
              { text: `${wfres.stepName}` }
            ]
          },
          {
            type: "card",
            title: `${wfres.context.label || "New field"}: ${
              wfres.stepName
            } (step ${wfres.currentStep} / max ${wfres.maxSteps})`,
            contents: renderForm(wfres.renderForm, req.csrfToken())
          }
        ]
      });
    } else {
      if (wfres.flash) req.flash(...wfres.flash);
      res.redirect(wfres.redirect);
    }
  })
);
