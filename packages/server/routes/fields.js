/**
 *
 * Field Router
 * @category server
 * @module routes/fields
 * @subcategory routes
 */

const Router = require("express-promise-router");

const { getState } = require("@saltcorn/data/db/state");
const { renderForm } = require("@saltcorn/markup");
const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Trigger = require("@saltcorn/data/models/trigger");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");
const User = require("@saltcorn/data/models/user");
const {
  expressionValidator,
  get_async_expression_function,
  get_expression_function,
  freeVariables,
} = require("@saltcorn/data/models/expression");
const db = require("@saltcorn/data/db");

const {
  isAdmin,
  error_catcher,
  isAdminOrHasConfigMinRole,
} = require("./utils.js");
const expressionBlurb = require("../markup/expression_blurb");
const {
  readState,
  add_free_variables_to_joinfields,
  calcfldViewConfig,
} = require("@saltcorn/data/plugin-helper");
const { wizardCardTitle } = require("../markup/forms.js");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const { applyAsync, isWeb } = require("@saltcorn/data/utils");
const { text, div } = require("@saltcorn/markup/tags");
const { mkFormContentNoLayout } = require("@saltcorn/markup/form");

/**
 * @type {object}
 * @const
 * @namespace fieldsRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @param {object} req
 * @param {*} fkey_opts
 * @param {*} existing_names
 * @param {*} id
 * @param {*} hasData
 * @returns {Promise<Form>}
 */
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
  const roleOptions = (await User.get_roles()).map((r) => ({
    value: r.id,
    label: r.role,
  }));
  return new Form({
    action: "/field",
    validator: (vs) => {
      if (vs.calculated && vs.type === "File")
        return req.__("Calculated fields cannot have File type");
      if (vs.calculated && !vs.stored && vs.type.startsWith("Key to"))
        return req.__("Calculated non-stored fields cannot have Key type");
    },
    fields: [
      new Field({
        label: req.__("Label"),
        name: "label",
        sublabel: req.__("Name of the field"),
        type: "String",
        attributes: { autofocus: true },
        help: {
          topic: "Field label",
          context: {},
        },
        validator(s) {
          if (!s || s === "") return req.__("Missing label");
          if (!id && existing_names.includes(Field.labelToName(s)))
            return req.__("Column %s already exists", s);
          if (Field.labelToName(s) === "row")
            return req.__("Not a valid field name");
          try {
            new Function(Field.labelToName(s), "return;");
          } catch {
            return req.__("Not a valid field name");
          }
        },
      }),
      new Field({
        label: req.__("Type"),
        name: "type",
        sublabel: req.__(
          "The type determines the kind of data that can be stored in the field"
        ),
        input_type: "select",
        help: {
          topic: "Field types",
          context: {},
        },
        options: isPrimary
          ? primaryTypes
          : getState().type_names.concat(fkey_opts || []),
        disabled:
          !!id &&
          !getState().getConfig("development_mode", false) &&
          (hasData || db.isSQLite),
      }),
      // description
      new Field({
        label: req.__("Description"),
        name: "description",
        sublabel: req.__(
          "Description allows to give more information about field"
        ),
        input_type: "text",
      }),

      new Field({
        label: req.__("Calculated"),
        name: "calculated",
        sublabel: req.__("Calculated from other fields with a formula"),
        type: "Bool",
        disabled: !!id,
        help: {
          topic: "Calculated fields",
        },
      }),
      new Field({
        label: req.__("Required"),
        name: "required",
        type: "Bool",
        sublabel: req.__("There must be a value in every row"),
        disabled: !!id && db.isSQLite,
        showIf: { calculated: false },
      }),
      new Field({
        label: req.__("Unique"),
        name: "is_unique",
        sublabel: req.__(
          "Different rows must have different values for this field"
        ),
        showIf: { calculated: false },
        type: "Bool",
      }),
      new Field({
        label: req.__("Error message"),
        name: "unique_error_msg",
        sublabel: req.__("Error shown to user if uniqueness is violated"),
        showIf: { calculated: false, is_unique: true },
        type: "String",
      }),

      new Field({
        label: req.__("Stored"),
        name: "stored",
        sublabel: req.__("Calculated field will be stored in Database"),
        type: "Bool",
        disabled: !!id,
        showIf: { calculated: true },
        help: {
          topic: "Calculated fields",
        },
      }),
      new Field({
        label: req.__("Protected"),
        name: "protected",
        sublabel: req.__("Set role to access"),
        type: "Bool",
        showIf: { calculated: false },
        help: {
          topic: "Protected fields",
        },
      }),
      {
        label: req.__("Minimum role to write"),
        name: "min_role_write",
        input_type: "select",
        sublabel: req.__(
          "User must have this role or higher to update or create field values"
        ),
        options: roleOptions,
        showIf: { protected: true },
      },
    ],
  });
};

/**
 * @param {string} ctxType
 * @returns {object}
 */
const calcFieldType = (ctxType) =>
  ctxType.startsWith("Key to")
    ? { type: "Key", reftable_name: ctxType.replace("Key to ", "") }
    : { type: ctxType };

/**
 * @param {*} attrs
 * @param {object} req
 * @returns {*}
 */
const translateAttributes = (attrs, req) =>
  Array.isArray(attrs)
    ? attrs.map((attr) => translateAttribute(attr, req))
    : attrs;

/**
 * @param {*} attr
 * @param {*} req
 * @returns {object}
 */
const translateAttribute = (attr, req) => {
  let res = { ...attr, label: req.__(attr.label) };
  if (res.sublabel) res.sublabel = req.__(res.sublabel);
  if (res.isRepeat) res = new FieldRepeat(res);
  return res;
};

/**
 * @param {*} req
 * @returns {Workflow}
 */
const fieldFlow = (req) =>
  new Workflow({
    action: "/field",
    onDone: async (context) => {
      //const thetype = getState().types[context.type];
      const attributes = context.attributes || {};
      attributes.default = context.default;
      attributes.summary_field = context.summary_field;
      attributes.include_fts = context.include_fts;
      attributes.on_delete_cascade = context.on_delete_cascade;
      attributes.on_delete = context.on_delete;
      attributes.unique_error_msg = context.unique_error_msg;
      if (context.protected) attributes.min_role_write = context.min_role_write;
      else attributes.min_role_write = undefined;
      const {
        table_id,
        name,
        label,
        required,
        is_unique,
        calculated,
        stored,
        description,
      } = context;
      let expression = context.expression;
      if (context.expression_type === "Model prediction") {
        const { model, model_instance, model_output } = context;
        expression = `${model}(${
          model_instance && model_instance !== "Default"
            ? `"${model_instance}",`
            : ""
        }row).${model_output}`;
      }
      if (context.expression_type === "Aggregation") {
        expression = "__aggregation";
        attributes.agg_relation = context.agg_relation;
        attributes.agg_field = context.agg_field;
        attributes.agg_order_by = context.agg_order_by;
        attributes.aggwhere = context.aggwhere;
        attributes.aggregate = context.aggregate;
        const [table, ref] = context.agg_relation.split(".");
        attributes.table = table;
        attributes.ref = ref;
      }
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
        description,
      };
      if (fldRow.calculated) {
        fldRow.is_unique = false;
        fldRow.required = false;
      }
      const table = Table.findOne({ id: table_id });
      if (context.id) {
        const field = await Field.findOne({ id: context.id });
        try {
          if (fldRow.label && field.label != fldRow.label) {
            fldRow.name = Field.labelToName(fldRow.label);
          }

          await field.update(fldRow);
          Trigger.emitEvent(
            "AppChange",
            `Field ${fldRow.name} on table ${table?.name}`,
            req.user,
            {
              entity_type: "Field",
              entity_name: fldRow.name || fldRow.label,
            }
          );
        } catch (e) {
          console.error(e);
          return {
            redirect: `/table/${context.table_id}`,
            flash: ["error", e.message],
          };
        }
      } else {
        try {
          await Field.create(fldRow);
          Trigger.emitEvent(
            "AppChange",
            `Field ${fldRow.name} on table ${table?.name}`,
            req.user,
            {
              entity_type: "Field",
              entity_name: fldRow.name || fldRow.label,
            }
          );
        } catch (e) {
          console.error(e);
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
          const existing_fields = table.getFields();
          const existingNames = existing_fields.map((f) => f.name);
          const fkey_opts = [
            "File",
            ...tables
              .filter((t) => !t.provider_name && !t.external)
              .map((t) => `Key to ${t.name}`),
          ];
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
          if (context.min_role_write) context.protected = true;
          return form;
        },
      },
      {
        name: req.__("Attributes"),
        contextField: "attributes",
        onlyWhen: (context) => {
          const type = getState().types[context.type];
          if (context.calculated && !type?.setTypeAttributesForCalculatedFields)
            return false;

          if (context.type === "File") return true;
          if (new Field(context).is_fkey) return false;
          if (!type) return false;
          const attrs = Field.getTypeAttributes(
            type.attributes,
            context.table_id
          );
          return attrs.length > 0;
        },
        form: async (context) => {
          if (context.type === "File") {
            const roles = await User.get_roles();
            const default_file_accept_filter = await getState().getConfig(
              "files_accept_filter_default"
            );
            //console.log("default_file_accept_filter",default_file_accept_filter);
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
                {
                  name: "also_delete_file",
                  type: "Bool",
                  label: req.__("Cascade delete to file"),
                  sublabel: req.__(
                    "Deleting a row will also delete the file referenced by this field"
                  ),
                },
                {
                  name: "files_accept_filter",
                  type: "String",
                  label: req.__("Files accept filter"),
                  sublabel: req.__(
                    "Specifies a filter for what file types the user can pick from the file input dialog box. Example is `.doc,audio/*,video/*,image/*`"
                  ),
                  default: default_file_accept_filter,
                },
              ],
            });
          } else {
            const type = getState().types[context.type];
            const attrs = Field.getTypeAttributes(
              type.attributes,
              context.table_id
            );

            return new Form({
              validator(vs) {
                if (type.validate_attributes) {
                  const res = type.validate_attributes(vs);
                  if (!res) return req.__("Invalid attributes");
                }
              },
              fields: translateAttributes(attrs, req),
            });
          }
        },
      },
      {
        name: req.__("Expression"),
        onlyWhen: (context) => context.calculated,
        form: async (context) => {
          const table = Table.findOne({ id: context.table_id });
          const fields = table.getFields();
          const models = await table.get_models();
          const instance_options = {};
          const output_options = {};
          for (const model of models) {
            instance_options[model.name] = ["Default"];
            const instances = await model.get_instances();
            instance_options[model.name].push(...instances.map((i) => i.name));

            const outputs = await applyAsync(
              model.templateObj?.prediction_outputs || [], // unit tests can have templateObj undefined
              { table, configuration: model.configuration }
            );
            output_options[model.name] = outputs.map((o) => o.name);
          }
          const aggStatOptions = {};

          const { child_field_list, child_relations } =
            await table.get_child_relations(true);
          const agg_field_opts = [];
          const agg_order_opts = [];
          child_relations.forEach(({ table, key_field, through }) => {
            const aggKey =
              (through ? `${through.name}->` : "") +
              `${table.name}.${key_field.name}`;
            aggStatOptions[aggKey] = [
              "Count",
              "CountUnique",
              "Avg",
              "Sum",
              "Max",
              "Min",
              "Array_Agg",
            ];
            table.fields.forEach((f) => {
              if (f.type && f.type.name === "Date") {
                aggStatOptions[aggKey].push(`Latest ${f.name}`);
                aggStatOptions[aggKey].push(`Earliest ${f.name}`);
              }
            });
            agg_field_opts.push({
              name: `agg_field`,
              label: req.__("On Field"),
              type: "String",
              required: true,
              attributes: {
                options: table.fields
                  .filter((f) => !f.calculated || f.stored)
                  .map((f) => ({
                    label: f.name,
                    name: `${f.name}@${f.type_name}`,
                  })),
              },
              showIf: {
                agg_relation: aggKey,
                expression_type: "Aggregation",
              },
            });
            agg_order_opts.push({
              name: `agg_order_by`,
              label: req.__("Order by"),
              type: "String",
              attributes: {
                options: table.fields
                  .filter((f) => !f.calculated || f.stored)
                  .map((f) => ({
                    label: f.name,
                    name: f.name,
                  })),
              },
              showIf: {
                agg_relation: aggKey,
                expression_type: "Aggregation",
                aggregate: "Array_Agg",
              },
            });
          });
          return new Form({
            fields: [
              {
                name: "expression_type",
                label: "Formula type",
                input_type: "select",
                options: [
                  "JavaScript expression",
                  ...(child_relations.length && context.stored
                    ? ["Aggregation"]
                    : []),
                  ...(models.length ? ["Model prediction"] : []),
                ],
              },
              {
                name: "agg_relation",
                label: req.__("Relation"),
                type: "String",
                required: true,
                attributes: {
                  options: child_field_list,
                },
                showIf: { expression_type: "Aggregation" },
              },
              ...agg_field_opts,
              {
                name: "aggregate",
                label: req.__("Statistic"),
                type: "String",
                required: true,
                attributes: {
                  calcOptions: ["agg_relation", aggStatOptions],
                },

                showIf: { expression_type: "Aggregation" },
              },
              {
                name: "aggwhere",
                label: req.__("Where"),
                sublabel: req.__("Formula"),
                class: "validate-expression",
                type: "String",
                required: false,
                showIf: { expression_type: "Aggregation" },
              },
              ...agg_order_opts,
              {
                name: "model",
                label: req.__("Model"),
                input_type: "select",
                options: models.map((m) => m.name),
                showIf: { expression_type: "Model prediction" },
              },
              {
                name: "model_instance",
                label: req.__("Model instance"),
                type: "String",
                required: true,
                attributes: {
                  calcOptions: ["model", instance_options],
                },
                showIf: { expression_type: "Model prediction" },
              },
              {
                name: "model_output",
                label: req.__("Prediction output"),
                type: "String",
                required: true,
                attributes: {
                  calcOptions: ["model", output_options],
                },
                showIf: { expression_type: "Model prediction" },
              },
              {
                input_type: "custom_html",
                name: "expr_blurb",
                label: " ",
                showIf: { expression_type: "JavaScript expression" },
                attributes: {
                  html: expressionBlurb(
                    context.type,
                    context.stored,
                    table,
                    req
                  ),
                },
              },
              new Field({
                name: "expression",
                label: req.__("Formula"),
                // todo sublabel
                type: "String",
                class: "validate-expression",
                fieldview: "textarea",
                attributes: { rows: 2 },
                validator: expressionValidator,
                showIf: { expression_type: "JavaScript expression" },
              }),
              new Field({
                name: "test_btn",
                label: req.__("Test"),
                showIf: {
                  expression_type: ["JavaScript expression"],
                },
                // todo sublabel
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
          const table = Table.findOne({ name: fld.reftable_name });
          const fields = table.getFields();
          const orderedFields = [
            ...fields.filter((f) => !f.primary_key),
            ...fields.filter((f) => f.primary_key),
          ];
          const keyfields = orderedFields
            .filter((f) => !f.calculated || f.stored)
            .sort((a, b) =>
              a.type?.name === "String" && b.type?.name !== "String"
                ? -1
                : a.type?.name !== "String" && b.type?.name === "String"
                  ? 1
                  : 0
            )
            .map((f) => ({
              value: f.name,
              label: `${f.label} [${f.type?.name || f.type}]`,
            }));
          const textfields = orderedFields
            .filter(
              (f) => (!f.calculated || f.stored) && f.type?.sql_name === "text"
            )
            .map((f) => f.name);
          return new Form({
            fields: [
              new Field({
                name: "summary_field",
                label: req.__("Summary field"),
                sublabel: req.__(
                  "The field that will be shown to the user when choosing a value"
                ),
                input_type: "select",
                options: keyfields,
              }),
              new Field({
                name: "include_fts",
                label: req.__("Include in full-text search"),
                type: "Bool",
                showIf: { summary_field: textfields },
              }),
              new Field({
                name: "on_delete",
                label: req.__("On delete"),
                input_type: "select",
                options: ["Fail", "Cascade", "Set null"],
                required: true,
                attributes: {
                  explainers: {
                    Fail: req.__("Prevent any deletion of parent rows"),
                    Cascade: req.__(
                      "If the parent row is deleted, automatically delete the child rows."
                    ),
                    "Set null": req.__(
                      "If the parent row is deleted, set key fields on child rows to null"
                    ),
                  },
                },
                sublabel: req.__(
                  "If the parent row is deleted, do this to the child rows."
                ),
              }),
            ],
          });
        },
      },
      {
        name: req.__("Default"),
        onlyWhen: async (context) =>
          context.required && !context.calculated && !context.primary_key,

        form: async (context) => {
          const table = Table.findOne({ id: context.table_id });
          const nrows = await table.countRows();
          const formfield = new Field({
            name: "default",
            label: req.__("Default"),
            // todo sublabel
            type: context.type,
            required: true,
            attributes: {
              summary_field: context.summary_field,
              ...(context.attributes || {}),
            },
          });
          await formfield.fill_fkey_options();
          const defaultOptional = nrows === 0 || context.id;
          if (defaultOptional) formfield.showIf = { set_default: true };

          const form = new Form({
            blurb: defaultOptional
              ? req.__("Set a default value for missing data")
              : req.__(
                  "A default value is required when adding required fields to nonempty tables"
                ),
            fields: [
              ...(defaultOptional
                ? [{ name: "set_default", label: "Set Default", type: "Bool" }]
                : []),
              formfield,
            ],
          });
          if (
            typeof context.default !== "undefined" &&
            context.default !== null
          )
            form.values.set_default = true;
          return form;
        },
      },
    ],
  });

/**
 * @name get/:id
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.get(
  "/:id",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_inspect_tables",
  ]),
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const field = await Field.findOne({ id });
    if (!field) {
      req.flash("danger", req.__(`Field not found`));
      res.redirect(`/table`);
      return;
    }
    const table = Table.findOne({ id: field.table_id });
    if (!field.type) {
      req.flash("danger", req.__(`Type %s not found`, field.typename));
      res.redirect(`/table/${field.table_id}`);
      return;
    }
    const wf = fieldFlow(req);
    const wfres = await wf.run(
      {
        ...field.toJson,
        ...field.attributes,
        ...(field.expression === "__aggregation"
          ? { expression_type: "Aggregation" }
          : {}),
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
          class: "mt-0",
          title: wizardCardTitle(field.label, wf, wfres),
          contents: renderForm(wfres.renderForm, req.csrfToken()),
        },
      ],
    });
  })
);

/**
 * @name get/new/:table_id
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.get(
  "/new/:table_id",
  isAdminOrHasConfigMinRole("min_role_edit_tables"),
  error_catcher(async (req, res) => {
    const { table_id } = req.params;
    const table = Table.findOne({ id: table_id });
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
          class: "mt-0",
          title: wizardCardTitle(req.__(`New field`), wf, wfres),
          contents: renderForm(wfres.renderForm, req.csrfToken()),
        },
      ],
    });
  })
);

/**
 * @name post/delete/:id
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.post(
  "/delete/:id",
  isAdminOrHasConfigMinRole("min_role_edit_tables"),
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const f = await Field.findOne({ id });
    if (!f) {
      req.flash("danger", req.__(`Field not found`));
      res.redirect(`/table`);
      return;
    }
    const table_id = f.table_id;

    await f.delete();
    req.flash("success", req.__(`Field %s deleted`, f.label));
    res.redirect(`/table/${table_id}`);
  })
);

/**
 * @name post
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.post(
  "/",
  isAdminOrHasConfigMinRole("min_role_edit_tables"),
  error_catcher(async (req, res) => {
    const wf = fieldFlow(req);
    const wfres = await wf.run(req.body || {}, req);
    if (wfres.renderForm) {
      const table = Table.findOne({ id: wfres.context.table_id });
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
            class: "mt-0",
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

/**
 * Test formula
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.post(
  "/test-formula",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_inspect_tables",
  ]),
  error_catcher(async (req, res) => {
    let { formula, tablename, stored } = req.body || {};
    if (stored === "false") stored = false;

    const table = Table.findOne({ name: tablename });
    const fields = table.getFields();
    const freeVars = freeVariables(formula);
    const joinFields = {};
    add_free_variables_to_joinfields(freeVars, joinFields, fields);
    if (!stored && Object.keys(joinFields).length > 0) {
      return res
        .status(400)
        .send(`Joinfields only permitted in stored calculated fields`);
    }
    const rows = await table.getJoinedRows({
      joinFields,
      orderBy: "RANDOM()",
      limit: 1,
    });
    if (rows.length < 1) {
      res.send("No rows in table");
      return;
    }
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
      console.error(e);
      return res
        .status(400)
        .send(`Error on running on row with id=${rows[0].id}: ${e.message}`);
    }
  })
);

/**
 * @name post/show-calculated/:tableName/:fieldName/:fieldview
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.post(
  "/show-calculated/:tableName/:fieldName/:fieldview",
  error_catcher(async (req, res) => {
    const { tableName, fieldName, fieldview } = req.params;
    const table = Table.findOne({ name: tableName });
    const role = req.user && req.user.id ? req.user.role_id : 100;

    getState().log(
      5,
      `Route /fields/show-calculated/${tableName}/${fieldName}/${fieldview} user=${req.user?.id}`
    );

    const fields = table.getFields();
    let row = { ...(req.body || {}) };
    if (row && Object.keys(row).length > 0) readState(row, fields);

    //need to get join fields from ownership into row
    const joinFields = {};
    if (table.ownership_formula && role > table.min_role_read) {
      const freeVars = freeVariables(table.ownership_formula);
      add_free_variables_to_joinfields(freeVars, joinFields, fields);
    }
    //console.log(joinFields, row);
    const id = req.query.id || row.id;
    if (id) {
      let [dbrow] = await table.getJoinedRows({ where: { id }, joinFields });
      row = { ...dbrow, ...row };
      //prevent overwriting ownership field
      if (table.ownership_field_id) {
        const ofield = fields.find((f) => f.id === table.ownership_field_id);
        row[ofield.name] = dbrow[ofield.name];
      }
    } else {
      //may need to add joinfields
      for (const { ref } of Object.values(joinFields)) {
        if (row[ref]) {
          const field = fields.find((f) => f.name === ref);
          const reftable = Table.findOne({ name: field.reftable_name });
          const refFields = await reftable.getFields();

          const joinFields = {};
          if (reftable.ownership_formula && role > reftable.min_role_read) {
            const freeVars = freeVariables(reftable.ownership_formula);
            add_free_variables_to_joinfields(freeVars, joinFields, refFields);
          }
          const [refRow] = await reftable.getJoinedRows({
            where: { id: row[ref] },
            joinFields,
          });
          if (
            role <= reftable.min_role_read ||
            (req.user && reftable.is_owner(req.user, refRow))
          ) {
            row[ref] = refRow;
          }
        }
      }
    }
    if (
      role > table.min_role_read &&
      !(req.user && table.is_owner(req.user, row))
    ) {
      //console.log("not owner", row, table.is_owner(req.user, row));
      res.status(401).send("");
      return;
    }
    if (fieldName.includes(".")) {
      //join field
      const kpath = fieldName.split(".");
      if (kpath.length === 2 && row[kpath[0]]) {
        const field = fields.find((f) => f.name === kpath[0]);
        const reftable = Table.findOne({ name: field.reftable_name });
        const refFields = await reftable.getFields();
        const targetField = refFields.find((f) => f.name === kpath[1]);
        //console.log({ kpath, fieldview, targetField });
        const q = { [reftable.pk_name]: row[kpath[0]] };
        const joinFields = {};
        if (reftable.ownership_formula && role > reftable.min_role_read) {
          const freeVars = freeVariables(reftable.ownership_formula);
          add_free_variables_to_joinfields(freeVars, joinFields, refFields);
        }
        const [refRow] = await reftable.getJoinedRows({ where: q, joinFields });
        if (
          role > reftable.min_role_read &&
          !(req.user && reftable.is_owner(req.user, refRow))
        ) {
          //console.log("not jointable owner", refRow);

          res.status(401).send("");
          return;
        }
        let fv;
        if (targetField.type === "Key") {
          fv = getState().keyFieldviews[fieldview];
          if (!fv) {
            const reftable2 = Table.findOne({
              name: targetField.reftable_name,
            });
            const refRow2 = await reftable2.getRow(
              {
                [reftable2.pk_name]: refRow[kpath[1]],
              },
              { forUser: req.user, forPublic: !req.user }
            );
            if (refRow2) {
              res.send(
                text(`${refRow2[targetField.attributes.summary_field]}`)
              );
            } else {
              res.send("");
            }
            return;
          }
        }
        if (targetField.type === "File") {
          fv = getState().fileviews[fieldview];
        } else {
          fv = targetField.type?.fieldviews?.[fieldview];
          if (!fv)
            fv =
              targetField.type.fieldviews.show ||
              targetField.type.fieldviews.as_text;
        }

        const configuration = req.query;
        let configFields = [];
        if (fv.configFields)
          configFields = await applyAsync(fv.configFields, targetField);
        readState(configuration, configFields);
        res.send(fv.run(refRow[kpath[1]], req, configuration));
        return;
      } else if (row[kpath[0]]) {
        let oldTable = table;
        let oldRow = row;
        for (const ref of kpath) {
          const ofields = await oldTable.getFields();
          const field = ofields.find((f) => f.name === ref);
          if (field.is_fkey) {
            const reftable = Table.findOne({ name: field.reftable_name });
            if (!oldRow[ref]) break;
            if (role > reftable.min_role_read) {
              res.status401.send("");
              return;
            }
            const q = { [reftable.pk_name]: oldRow[ref] };
            oldRow = await reftable.getRow(q, {
              forUser: req.user,
              forPublic: !req.user,
            });
            oldTable = reftable;
          }
        }
        if (oldRow) {
          const value = oldRow[kpath[kpath.length - 1]];
          //TODO run fieldview
          if (value === null || typeof value === "undefined") res.send("");
          else
            res.send(
              typeof value === "string"
                ? value
                : value?.toString
                  ? value.toString()
                  : `${value}`
            );
          return;
        }
      }
      res.send("");
      return;
    }

    const field = fields.find((f) => f.name === fieldName);

    const formula = field.expression;

    let result;
    try {
      if (!field.calculated) {
        result = row[field.name];
      } else if (field.stored && field.expression === "__aggregation") {
        result = row[field.name];
      } else if (field.stored) {
        const f = get_async_expression_function(formula, fields);
        //are there join fields in formula?
        const joinFields = {};
        add_free_variables_to_joinfields(
          freeVariables(formula),
          joinFields,
          table.fields
        );
        for (const { target, ref, through, rename_object } of Object.values(
          joinFields
        )) {
          const jf = table.getField(ref);
          const jtable = Table.findOne(jf.reftable_name);
          const jrow = await jtable.getRow(
            { [jtable.pk_name]: row[ref]?.[jtable.pk_name] || row[ref] },
            { forUser: req.user, forPublic: !req.user }
          );
          row[ref] = jrow;
          if (through) {
            const jf2 = jtable.getField(through);
            const jtable2 = Table.findOne(jf2.reftable_name);
            const jrow2 = await jtable2.getRow(
              {
                [jtable2.pk_name]: jrow[through],
              },
              { forUser: req.user, forPublic: !req.user }
            );
            row[ref][through] = jrow2;
          }
        }

        result = await f(row);
      } else {
        const f = get_expression_function(formula, fields);
        result = f(row);
      }
      const configuration = req.query;
      const fv = field.type.fieldviews[fieldview];
      if (!fv) res.send(text(result));
      else res.send(fv.run(result, req, { row, ...configuration }));
    } catch (e) {
      console.error("show-calculated error", e);
      return res.status(200).send(``);
    }
  })
);

/**
 * @name post/preview/:tableName/:fieldName/:fieldview
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.post(
  "/preview/:tableName/:fieldName/:fieldview",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_edit_views",
    "min_role_inspect_tables",
  ]),
  error_catcher(async (req, res) => {
    const { tableName, fieldName, fieldview } = req.params;
    const table = Table.findOne({ name: tableName });
    const fields = table.getFields();
    const state = getState();

    state.log(
      5,
      `Route /fields/preview/${tableName}/${fieldName}/${fieldview} user=${req.user?.id}`
    );

    let field, row, value;
    if (fieldName.includes(".")) {
      const [refNm, targetNm] = fieldName.split(".");
      const ref = fields.find((f) => f.name === refNm);
      if (!ref) {
        res.send("");
        return;
      }
      const reftable = Table.findOne({ name: ref.reftable_name });
      if (!reftable) {
        res.send("");
        return;
      }
      const reffields = await reftable.getFields();
      field = reffields.find((f) => f.name === targetNm);
      row = await reftable.getRow({}, { forUser: req.user });
      value = row && row[targetNm];
    } else {
      field = fields.find((f) => f.name === fieldName);
      row = await table.getRow({}, { forUser: req.user });
      value = row && row[fieldName];
    }

    const configuration = (req.body || {}).configuration;
    if (!field) {
      res.send("");
      return;
    }
    const fieldviews =
      field.type === "Key"
        ? state.keyFieldviews
        : field.type === "File"
          ? state.fileviews
          : field.type.fieldviews;
    if (!field.type || !fieldviews) {
      res.send("");
      return;
    }
    //const firefox = /firefox/i.test(req.headers["user-agent"]);

    //Chrome 116 changes its behaviour to align with firefox
    // - disabled inputs do not dispactch click events
    const firefox = true;
    const fv = fieldviews[fieldview];
    field.fieldview === fieldview;
    field.fieldviewObj = fv;
    field.attributes = { ...configuration, ...field.attributes };
    if (field.type === "Key")
      await field.fill_fkey_options(
        false,
        {},
        {},
        undefined,
        undefined,
        undefined,
        req.user
      );
    if (!fv && field.type === "Key" && fieldview === "select")
      res.send(
        `<input ${
          firefox ? "readonly" : "disabled"
        } class="form-control form-select"></input>`
      );
    else if (!fv) res.send("");
    else if (fv.isEdit || fv.isFilter)
      res.send(
        fv.run(
          field.name,
          undefined,
          {
            ...(firefox ? { readonly: true } : { disabled: true }),
            ...configuration,
            ...(field.attributes || {}),
          },
          "",
          false,
          field
        )
      );
    else if (field.type === "File") {
      res.send(fv.run(value, "filename.ext"));
    } else res.send(fv.run(value, req, configuration));
  })
);

/**
 * @name post/preview/:tableName/:fieldName/
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.post(
  "/preview/:tableName/:fieldName/",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_edit_views",
    "min_role_inspect_tables",
  ]),
  error_catcher(async (req, res) => {
    res.send("");
  })
);

router.post(
  "/fieldviewcfgform/:tableName",
  isAdminOrHasConfigMinRole([
    "min_role_edit_tables",
    "min_role_edit_views",
    "min_role_inspect_tables",
  ]),
  error_catcher(async (req, res) => {
    const { tableName } = req.params;
    let {
      field_name,
      fieldview,
      type,
      join_field,
      join_fieldview,
      agg_outcome_type,
      agg_fieldview,
      agg_field,
      mode,
      _columndef,
    } = req.body || {};
    const table = Table.findOne({ name: tableName });
    if (agg_outcome_type && agg_fieldview) {
      const type = getState().types[agg_outcome_type];
      const fv = type?.fieldviews?.[agg_fieldview];
      if (!fv?.configFields) {
        res.send(req.query?.accept == "json" ? "[]" : "");
        return;
      }
      const field = table.getField(agg_field);
      const cfgfields = await applyAsync(fv.configFields, field || { table }, {
        mode,
      });
      res.json(cfgfields);
      return;
    }
    if (typeof type !== "string") {
      try {
        type = JSON.parse(_columndef).type;
      } catch {
        //ignore
      }
    }
    const fieldName = type == "Field" ? field_name : join_field;
    const fv_name = type == "Field" ? fieldview : join_fieldview;
    if (!fieldName) {
      res.send(req.query?.accept == "json" ? "[]" : "");
      return;
    }

    const field = table.getField(fieldName);
    if (!field) {
      res.send(req.query?.accept == "json" ? "[]" : "");
      return;
    }
    const fieldViewConfigForms = await calcfldViewConfig(
      [field],
      false,
      0,
      mode,
      req
    );
    const formFields = fieldViewConfigForms[field.name][fv_name];
    if (!formFields) {
      res.send(req.query?.accept == "json" ? "[]" : "");
      return;
    }
    formFields.forEach((ff) => {
      ff.class = ff.class ? `${ff.class} item-menu` : "item-menu";
    });
    if (req.query?.accept == "json") {
      res.json(formFields);
      return;
    }

    const form = new Form({
      formStyle: "vert",
      fields: formFields,
    });
    if (_columndef && _columndef !== "undefined")
      form.values = JSON.parse(_columndef);
    res.send(mkFormContentNoLayout(form));
  })
);

router.post(
  "/edit-get-fieldview",
  error_catcher(async (req, res) => {
    const { field_name, table_name, pk, fieldview, configuration } = req.body;
    const table = Table.findOne({ name: table_name });
    const row = await table.getRow(
      { [table.pk_name]: pk },
      { forUser: req.user, forPublic: !req.user }
    );
    const field = table.getField(field_name);
    let fv;
    if (field.is_fkey) {
      await field.fill_fkey_options(
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        row[field_name],
        req.user
      );
      fv = getState().keyFieldviews.select;
    } else if (fieldview === "subfield" && field.type?.name === "JSON") {
      fv = field.type.fieldviews.edit_subfield;
    } else {
      //TODO: json subfield is special
      const fieldviews = field.type.fieldviews;
      fv = Object.values(fieldviews).find((v) => v.isEdit);
    }
    res.send(
      fv.run(
        field_name,
        row[field_name],
        {
          ...field.attributes,
          ...configuration,
        },
        "",
        false,
        field
      )
    );
  })
);

router.post(
  "/save-click-edit",
  error_catcher(async (req, res) => {
    const fielddata = JSON.parse(decodeURIComponent(req.body._fielddata));
    const { field_name, table_name, pk, fieldview, configuration, join_field } =
      fielddata;
    const table = Table.findOne({ name: table_name });
    const field = table.getField(field_name);
    let val = field.type?.read
      ? field.type?.read(req.body[field_name])
      : req.body[field_name];
    await table.updateRow({ [field_name]: val }, pk, req.user);
    let fv;
    if (field.is_fkey) {
      if (join_field) {
        const refTable = Table.findOne({ name: field.reftable_name });
        const refRow = await refTable.getRow({ [refTable.pk_name]: val });
        val = refRow[join_field];
        const targetField = refTable.getField(join_field);
        const fieldviews = targetField.type.fieldviews;

        fv = fieldviews[fieldview];
      } else fv = { run: (v) => `${v}` };
    } else {
      const fieldviews = field.type.fieldviews;

      fv = fieldviews[fieldview];

      if (!fv) {
        const fv1 = Object.values(fieldviews).find(
          (v) => !v.isEdit && !v.isFilter
        );
        fv = fv1;
      }
    }

    res.send(
      div(
        {
          "data-inline-edit-fielddata": req.body._fielddata,
          "data-inline-edit-ajax": "true",
          "data-inline-edit-dest-url": `/api/${table.name}/${pk}`,
          class: !isWeb(req) ? "mobile-data-inline-edit" : "",
        },
        fv.run(val, req, {
          ...field.attributes,
          ...configuration,
        })
      )
    );
  })
);
