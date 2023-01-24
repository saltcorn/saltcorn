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

const { isAdmin, error_catcher } = require("./utils.js");
const expressionBlurb = require("../markup/expression_blurb");
const {
  readState,
  add_free_variables_to_joinfields,
  calcfldViewConfig,
} = require("@saltcorn/data/plugin-helper");
const { wizardCardTitle } = require("../markup/forms.js");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const { applyAsync } = require("@saltcorn/data/utils");
const { text } = require("@saltcorn/markup/tags");
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
  return new Form({
    action: "/field",
    validator: (vs) => {
      if (vs.calculated && vs.type === "File")
        return req.__("Calculated fields cannot have File type");
      if (vs.calculated && vs.type.startsWith("Key to"))
        return req.__("Calculated fields cannot have Key type");
    },
    fields: [
      new Field({
        label: req.__("Label"),
        name: "label",
        sublabel: req.__("Name of the field"),
        input_type: "text",
        validator(s) {
          if (!s || s === "") return req.__("Missing label");
          if (!id && existing_names.includes(Field.labelToName(s)))
            return req.__("Column %s already exists", s);
        },
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
        label: req.__("Type"),
        name: "type",
        sublabel: req.__(
          "The type determines the kind of data that can be stored in the field"
        ),
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
        sublabel: req.__("Calculated from other fields with a formula"),
        type: "Bool",
        disabled: !!id,
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
        label: req.__("Stored"),
        name: "stored",
        type: "Bool",
        disabled: !!id,
        showIf: { calculated: true },
      }),
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
  let res = { ...attr };
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
      const {
        table_id,
        name,
        label,
        required,
        is_unique,
        calculated,
        expression,
        stored,
        description,
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
        description,
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
          const fkey_opts = ["File", ...tables.map((t) => `Key to ${t.name}`)];
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
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          return new Form({
            blurb: expressionBlurb(context.type, context.stored, fields, req),
            fields: [
              new Field({
                name: "expression",
                label: req.__("Formula"),
                // todo sublabel
                type: "String",
                class: "validate-expression",
                validator: expressionValidator,
              }),
              new Field({
                name: "test_btn",
                label: req.__("Test"),
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
                input_type: "select",
                options: keyfields,
              }),
              new Field({
                name: "include_fts",
                label: req.__("Include in full-text search"),
                type: "Bool",
                showIf: { summary_field: textfields },
              }),
              /*new Field({
                name: "on_delete_cascade",
                label: req.__("On delete cascade"),
                type: "Bool",
                sublabel: req.__(
                  "If the parent row is deleted, automatically delete the child rows."
                ),
              }),*/
              new Field({
                name: "on_delete",
                label: req.__("On delete"),
                input_type: "select",
                options: ["Fail", "Cascade", "Set null"],
                required: true,
                attributes: {
                  explainers: {
                    Fail: "Prevent any deletion of parent rows",
                    Cascade:
                      "If the parent row is deleted, automatically delete the child rows.",
                    "Set null":
                      "If the parent row is deleted, set key fields on child rows to null",
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
            // todo sublabel
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

/**
 * @name get/:id
 * @function
 * @memberof module:routes/fields~fieldsRouter
 * @function
 */
router.get(
  "/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const field = await Field.findOne({ id });
    if (!field) {
      req.flash("danger", req.__(`Field not found`));
      res.redirect(`/table`);
      return;
    }
    const table = await Table.findOne({ id: field.table_id });
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
  isAdmin,
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { formula, tablename, stored } = req.body;
    const table = await Table.findOne({ name: tablename });
    const fields = await table.getFields();
    const freeVars = freeVariables(formula);
    const joinFields = {};
    if (stored) add_free_variables_to_joinfields(freeVars, joinFields, fields);
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
      return res.send(
        `Error on running on row with id=${rows[0].id}: ${e.message}`
      );
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
    const table = await Table.findOne({ name: tableName });
    const role = req.user && req.user.id ? req.user.role_id : 10;

    const fields = await table.getFields();
    let row = { ...req.body };
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
          const reftable = await Table.findOne({ name: field.reftable_name });
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
        const reftable = await Table.findOne({ name: field.reftable_name });
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
            const refRow2 = await reftable2.getRow({
              [reftable2.pk_name]: refRow[kpath[1]],
            });
            if (refRow2) {
              res.send(
                text(`${refRow2[targetField.attributes.summary_field]}`)
              );
            } else {
              res.send("");
            }
            return;
          }
        } else {
          fv = targetField.type.fieldviews[fieldview];
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
            const reftable = await Table.findOne({ name: field.reftable_name });
            if (!oldRow[ref]) break;
            if (role > reftable.min_role_read) {
              res.status(401).send("");
              return;
            }
            const q = { [reftable.pk_name]: oldRow[ref] };
            oldRow = await reftable.getRow(q);
            oldTable = reftable;
          }
        }
        if (oldRow) {
          const value = oldRow[kpath[kpath.length - 1]];
          res.send(value);
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
      } else if (field.stored) {
        const f = get_async_expression_function(formula, fields);
        result = await f(row);
      } else {
        const f = get_expression_function(formula, fields);
        result = f(row);
      }
      const fv = field.type.fieldviews[fieldview];
      if (!fv) res.send(text(result));
      else res.send(fv.run(result));
    } catch (e) {
      return res.status(400).send(`Error: ${e.message}`);
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
  isAdmin,
  error_catcher(async (req, res) => {
    const { tableName, fieldName, fieldview } = req.params;
    const table = await Table.findOne({ name: tableName });
    const fields = await table.getFields();
    let field, row, value;
    if (fieldName.includes(".")) {
      const [refNm, targetNm] = fieldName.split(".");
      const ref = fields.find((f) => f.name === refNm);
      if (!ref) {
        res.send("");
        return;
      }
      const reftable = await Table.findOne({ name: ref.reftable_name });
      if (!reftable) {
        res.send("");
        return;
      }
      const reffields = await reftable.getFields();
      field = reffields.find((f) => f.name === targetNm);
      row = await reftable.getRow({});
      value = row && row[targetNm];
    } else {
      field = fields.find((f) => f.name === fieldName);
      row = await table.getRow({});
      value = row && row[fieldName];
    }

    const configuration = req.body.configuration;
    if (!field) {
      res.send("");
      return;
    }
    const fieldviews =
      field.type === "Key"
        ? getState().keyFieldviews
        : field.type === "File"
        ? getState().fileviews
        : field.type.fieldviews;
    if (!field.type || !fieldviews) {
      res.send("");
      return;
    }
    const fv = fieldviews[fieldview];
    if (!fv && field.type === "Key" && fieldview === "select")
      res.send(`<input readonly class="form-control form-select"></input>`);
    else if (!fv) res.send("");
    else if (fv.isEdit || fv.isFilter)
      res.send(
        fv.run(
          field.name,
          undefined,
          { readonly: true, ...configuration, ...(field.attributes || {}) },
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
  isAdmin,
  error_catcher(async (req, res) => {
    res.send("");
  })
);

router.post(
  "/fieldviewcfgform/:tableName",
  isAdmin,
  error_catcher(async (req, res) => {
    const { tableName } = req.params;
    const {
      field_name,
      fieldview,
      type,
      join_field,
      join_fieldview,
      _columndef,
    } = req.body;
    const table = await Table.findOne({ name: tableName });
    const fieldName = type == "Field" ? field_name : join_field;
    const fv_name = type == "Field" ? fieldview : join_fieldview;
    if (!fieldName) {
      res.send("");
      return;
    }

    const field = await table.getField(fieldName);

    const fieldViewConfigForms = await calcfldViewConfig([field], false, 0);
    const formFields = fieldViewConfigForms[field.name][fv_name];
    if (!formFields) {
      res.send("");
      return;
    }
    formFields.forEach((ff) => {
      ff.class = ff.class ? `${ff.class} item-menu` : "item-menu";
    });

    const form = new Form({
      formStyle: "vert",
      fields: formFields,
    });
    if (_columndef && _columndef !== "undefined")
      form.values = JSON.parse(_columndef);
    res.send(mkFormContentNoLayout(form));
  })
);
