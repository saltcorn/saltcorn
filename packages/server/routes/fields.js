const Router = require("express-promise-router");

const { getState } = require("@saltcorn/data/db/state");
const { renderForm } = require("@saltcorn/markup");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");
const { expressionValidator } = require("@saltcorn/data/models/expression");
const db = require("@saltcorn/data/db");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const expressionBlurb = require("../markup/expression_blurb");
const router = new Router();
module.exports = router;

const fieldForm = (req, fkey_opts, existing_names, id) =>
  new Form({
    action: "/field",
    validator: (vs) => {
      if (vs.calculated && vs.type == "File")
        return req.__("Calculated fields cannot have File type");
      if (vs.calculated && vs.type.startsWith("Key to"))
        return req.__("Calculated fields cannot have Key type");
    },
    fields: [
      new Field({
        label: req.__("Label"),
        name: "label",
        input_type: "text",
        validator(s) {
          if (!s || s === "") return req.__("Missing label");
          if (s.toLowerCase() === "id")
            return req.__("Column %s already exists (but is hidden)", s);
          if (!id && existing_names.includes(Field.labelToName(s)))
            return req.__("Column %s already exists", s);
        },
      }),
      new Field({
        label: req.__("Type"),
        name: "type",
        input_type: "select",
        options: getState().type_names.concat(fkey_opts || []),
        disabled: !!id && !getState().getConfig("development_mode", false),
      }),
      new Field({
        label: req.__("Calculated"),
        name: "calculated",
        type: "Bool",
        class: "iscalc",
        disabled: !!id,
      }),
      new Field({
        label: req.__("Required"),
        name: "required",
        type: "Bool",
        disabled: !!id && db.isSQLite,
        showIf: { ".iscalc": false },
      }),
      new Field({
        label: req.__("Unique"),
        name: "is_unique",
        showIf: { ".iscalc": false },
        type: "Bool",
      }),

      new Field({
        label: req.__("Stored"),
        name: "stored",
        type: "Bool",
        disabled: !!id,
        showIf: { ".iscalc": true },
      }),
    ],
  });

const calcFieldType = (ctxType) =>
  ctxType.startsWith("Key to")
    ? { type: "Key", reftable_name: ctxType.replace("Key to ", "") }
    : { type: ctxType };

const translateAttributes = (attrs, req) =>
  Array.isArray(attrs)
    ? attrs.map((attr) => translateAttribute(attr, req))
    : attrs;

const translateAttribute = (attr, req) => {
  const res = { ...attr };
  if (res.sublabel) res.sublabel = req.__(res.sublabel);
  return res;
};
const fieldFlow = (req) =>
  new Workflow({
    action: "/field",
    onDone: async (context) => {
      const thetype = getState().types[context.type];
      var attributes = context.attributes || {};
      attributes.default = context.default;
      attributes.summary_field = context.summary_field;
      const {
        table_id,
        name,
        label,
        required,
        is_unique,
        calculated,
        expression,
        stored,
      } = context;
      const { reftable_name, type } = calcFieldType(context.type);
      const fldRow = {
        table_id,
        name,
        label,
        type,
        required,
        is_unique,
        reftable_name,
        attributes,
        calculated,
        expression,
        stored,
      };
      if (fldRow.calculated) {
        fldRow.is_unique = false;
        fldRow.required = false;
      }
      if (context.id) {
        const field = await Field.findOne({ id: context.id });
        try {
          await field.update(fldRow);
        } catch (e) {
          return {
            redirect: `/table/${context.table_id}`,
            flash: ["error", e.message],
          };
        }
      } else {
        try {
          await Field.create(fldRow);
        } catch (e) {
          return {
            redirect: `/table/${context.table_id}`,
            flash: ["error", e.message],
          };
        }
      }

      return {
        redirect: `/table/${context.table_id}`,
        flash: [
          "success",
          context.id
            ? req.__("Field %s saved", label)
            : req.__("Field %s created", label),
        ],
      };
    },
    steps: [
      {
        name: req.__("Basic properties"),
        form: async (context) => {
          const tables = await Table.find({});
          const table = tables.find((t) => t.id === context.table_id);
          const existing_fields = await table.getFields();
          const existingNames = existing_fields.map((f) => f.name);
          const fkey_opts = [...tables.map((t) => `Key to ${t.name}`), "File"];
          const form = fieldForm(req, fkey_opts, existingNames, context.id);
          if (context.type === "Key" && context.reftable_name) {
            form.values.type = `Key to ${context.reftable_name}`;
          }
          return form;
        },
      },
      {
        name: req.__("Attributes"),
        contextField: "attributes",
        onlyWhen: (context) => {
          if (context.calculated) return false;
          if (context.type === "File") return true;
          if (new Field(context).is_fkey) return false;
          const type = getState().types[context.type];
          return type.attributes && type.attributes.length > 0;
        },
        form: async (context) => {
          if (context.type === "File") {
            const roles = await User.get_roles();
            return new Form({
              fields: [
                {
                  name: "min_role_read",
                  label: req.__("Role required to access added files"),
                  sublabel: req.__(
                    "The user uploading the file has access irrespective of their role"
                  ),
                  input_type: "select",
                  options: roles.map((r) => ({ value: r.id, label: r.role })),
                },
              ],
            });
          } else {
            return new Form({
              fields: translateAttributes(
                getState().types[context.type].attributes,
                req
              ),
            });
          }
        },
      },
      {
        name: req.__("Expression"),
        onlyWhen: (context) => context.calculated,
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          return new Form({
            blurb: expressionBlurb(context.type, context.stored, fields, req),
            fields: [
              new Field({
                name: "expression",
                label: req.__("Formula"),
                type: "String",
                validator: expressionValidator,
              }),
            ],
          });
        },
      },
      {
        name: req.__("Summary"),
        onlyWhen: (context) =>
          context.type !== "File" && new Field(context).is_fkey,
        form: async (context) => {
          const fld = new Field(context);
          const table = await Table.findOne({ name: fld.reftable_name });
          const fields = await table.getFields();
          const keyfields = fields
            .filter((f) => !f.calculated || f.stored)
            .map((f) => ({
              value: f.name,
              label: f.label,
            }));
          return new Form({
            fields: [
              new Field({
                name: "summary_field",
                label: req.__("Summary field"),
                input_type: "select",
                options: keyfields,
              }),
            ],
          });
        },
      },
      {
        name: req.__("Default"),
        onlyWhen: async (context) => {
          if (!context.required || context.id || context.calculated)
            return false;
          const table = await Table.findOne({ id: context.table_id });
          const nrows = await table.countRows();
          return nrows > 0;
        },
        form: async (context) => {
          const formfield = new Field({
            name: "default",
            label: req.__("Default"),
            type: context.type,
            required: true,
            attributes: {
              summary_field: context.summary_field,
              ...(context.attributes || {}),
            },
          });
          await formfield.fill_fkey_options();
          return new Form({
            blurb: req.__(
              "A default value is required when adding required fields to nonempty tables"
            ),
            fields: [formfield],
          });
        },
      },
    ],
  });
router.get(
  "/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const field = await Field.findOne({ id });
    const table = await Table.findOne({ id: field.table_id });
    const wfres = await fieldFlow(req).run(
      {
        ...field.toJson,
        ...field.attributes,
      },
      req
    );
    res.sendWrap(req.__(`Edit field`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: req.__(`Edit %s field`, field.label) },
            { text: wfres.stepName },
          ],
        },
        {
          type: "card",
          title: `${field.label}: ${wfres.title}`,
          contents: renderForm(wfres.renderForm, req.csrfToken()),
        },
      ],
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

    const wfres = await fieldFlow(req).run({ table_id: +table_id }, req);
    res.sendWrap(req.__(`New field`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: req.__(`Add field`) },
            { text: wfres.stepName },
          ],
        },
        {
          type: "card",
          title: req.__(`New field:`) + ` ${wfres.title}`,
          contents: renderForm(wfres.renderForm, req.csrfToken()),
        },
      ],
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
    req.flash("success", req.__(`Field %s deleted`, f.label));
    res.redirect(`/table/${table_id}`);
  })
);

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const wfres = await fieldFlow(req).run(req.body, req);
    if (wfres.renderForm) {
      const table = await Table.findOne({ id: wfres.context.table_id });
      res.sendWrap(req.__(`Field attributes`), {
        above: [
          {
            type: "breadcrumbs",
            crumbs: [
              { text: req.__("Tables"), href: "/table" },
              { href: `/table/${table.id}`, text: table.name },
              {
                text: req.__(
                  `Edit %s field`,
                  wfres.context.label || req.__("new")
                ),
              },
              { text: `${wfres.stepName}` },
            ],
          },
          {
            type: "card",
            title: `${wfres.context.label || req.__("New field")}: ${
              wfres.title
            }`,
            contents: renderForm(wfres.renderForm, req.csrfToken()),
          },
        ],
      });
    } else {
      if (wfres.flash) req.flash(...wfres.flash);
      res.redirect(wfres.redirect);
    }
  })
);
