const Router = require("express-promise-router");

const { getState } = require("@saltcorn/data/db/state");
const { renderForm } = require("@saltcorn/markup");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");
const {
  expressionValidator,
  get_async_expression_function,
  get_expression_function,
} = require("@saltcorn/data/models/expression");
const db = require("@saltcorn/data/db");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const expressionBlurb = require("../markup/expression_blurb");
const { readState } = require("@saltcorn/data/plugin-helper");
const { wizardCardTitle } = require("../markup/forms.js");
const router = new Router();
module.exports = router;

const fieldForm = async (req, fkey_opts, existing_names, id, hasData) => {
  let isPrimary = false;
  let primaryTypes = Object.entries(getState().types)
    .filter(([k, v]) => v.primaryKey)
    .map(([k, v]) => k);
  if (id) {
    const field = await Field.findOne({ id });
    if (field) {
      isPrimary = !!field.primary_key;
    }
  }
  return new Form({
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
          if (!id && existing_names.includes(Field.labelToName(s)))
            return req.__("Column %s already exists", s);
        },
      }),
      new Field({
        label: req.__("Type"),
        name: "type",
        input_type: "select",
        options: isPrimary
          ? primaryTypes
          : getState().type_names.concat(fkey_opts || []),
        disabled:
          !!id &&
          !getState().getConfig("development_mode", false) &&
          (hasData || db.isSQLite),
      }),
      new Field({
        label: req.__("Calculated"),
        name: "calculated",
        type: "Bool",
        disabled: !!id,
      }),
      new Field({
        label: req.__("Required"),
        name: "required",
        type: "Bool",
        disabled: !!id && db.isSQLite,
        showIf: { calculated: false },
      }),
      new Field({
        label: req.__("Unique"),
        name: "is_unique",
        showIf: { calculated: false },
        type: "Bool",
      }),

      new Field({
        label: req.__("Stored"),
        name: "stored",
        type: "Bool",
        disabled: !!id,
        showIf: { calculated: true },
      }),
    ],
  });
};
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
          const nrows = await table.countRows({});
          const existing_fields = await table.getFields();
          const existingNames = existing_fields.map((f) => f.name);
          const fkey_opts = [...tables.map((t) => `Key to ${t.name}`), "File"];
          const form = await fieldForm(
            req,
            fkey_opts,
            existingNames,
            context.id,
            nrows > 0
          );
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
            const type = getState().types[context.type];
            return new Form({
              validator(vs) {
                if (type.validate_attributes) {
                  const res = type.validate_attributes(vs);
                  if (!res) return req.__("Invalid attributes");
                }
              },
              fields: translateAttributes(type.attributes, req),
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
              new Field({
                name: "test_btn",
                label: req.__("Test"),
                input_type: "custom_html",
                attributes: {
                  html: `<button type="button" id="test_formula_btn" onclick="test_formula('${
                    table.name
                  }', ${JSON.stringify(
                    context.stored
                  )})" class="btn btn-outline-secondary">${req.__(
                    "Test"
                  )}</button>
                  <div id="test_formula_output"></div>`,
                },
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
          const orderedFields = [
            ...fields.filter((f) => !f.primary_key),
            ...fields.filter((f) => f.primary_key),
          ];
          const keyfields = orderedFields
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
    const wf = fieldFlow(req);
    const wfres = await wf.run(
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
            { workflow: wf, step: wfres },
          ],
        },
        {
          type: "card",
          title: wizardCardTitle(field.label, wf, wfres),
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
    const wf = fieldFlow(req);
    const wfres = await wf.run({ table_id: +table_id }, req);
    res.sendWrap(req.__(`New field`), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: req.__(`Add field`) },
            //{ text: wfres.stepName },
            { workflow: wf, step: wfres },
          ],
        },
        {
          type: "card",
          title: wizardCardTitle(req.__(`New field`), wf, wfres),
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
    const wf = fieldFlow(req);
    const wfres = await wf.run(req.body, req);
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
              { workflow: wf, step: wfres },
            ],
          },
          {
            type: "card",
            title: wizardCardTitle(
              wfres.context.label || req.__("New field"),
              wf,
              wfres
            ),
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

router.post(
  "/test-formula",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { formula, tablename, stored } = req.body;
    const table = await Table.findOne({ name: tablename });
    const fields = await table.getFields();
    const rows = await table.getRows({}, { orderBy: "RANDOM()", limit: 1 });
    if (rows.length < 1) return "No rows in table";
    let result;
    try {
      if (stored) {
        const f = get_async_expression_function(formula, fields);
        result = await f(rows[0]);
      } else {
        const f = get_expression_function(formula, fields);
        result = f(rows[0]);
      }
      res.send(
        `Result of running on row with id=${
          rows[0].id
        } is: <pre>${JSON.stringify(result)}</pre>`
      );
    } catch (e) {
      return res.send(
        `Error on running on row with id=${rows[0].id}: ${e.message}`
      );
    }
  })
);
router.post(
  "/show-calculated/:tableName/:fieldName/:fieldview",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { tableName, fieldName, fieldview } = req.params;
    const table = await Table.findOne({ name: tableName });
    const fields = await table.getFields();
    const field = fields.find((f) => f.name === fieldName);
    const formula = field.expression;
    const row = { ...req.body };
    readState(row, fields);
    let result;
    try {
      if (field.stored) {
        const f = get_async_expression_function(formula, fields);
        result = await f(row);
      } else {
        const f = get_expression_function(formula, fields);
        result = f(row);
      }
      const fv = field.type.fieldviews[fieldview];
      res.send(fv.run(result));
    } catch (e) {
      return res.status(400).send(`Error: ${e.message}`);
    }
  })
);
