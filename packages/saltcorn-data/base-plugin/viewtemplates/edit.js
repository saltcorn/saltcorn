/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/edit
 * @subcategory base-plugin
 */
const Field = require("../../models/field");
const File = require("../../models/file");
const Table = require("../../models/table");
const User = require("../../models/user");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { getState } = require("../../db/state");
const { text, text_attr } = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");
const FieldRepeat = require("../../models/fieldrepeat");
const {
  get_expression_function,
  expressionChecker,
} = require("../../models/expression");
const { InvalidConfiguration, isNode } = require("../../utils");
const Library = require("../../models/library");
const { check_view_columns } = require("../../plugin-testing");
const {
  initial_config_all_fields,
  calcfldViewOptions,
  calcfldViewConfig,
  get_parent_views,
  get_link_view_opts,
  picked_fields_to_query,
  stateFieldsToWhere,
  stateFieldsToQuery,
  strictParseInt,
} = require("../../plugin-helper");
const {
  splitUniques,
  getForm,
  fill_presets,
  parse_view_select,
  get_view_link_query,
  objToQueryString,
} = require("./viewable_fields");
const {
  traverse,
  getStringsForI18n,
  translateLayout,
  traverseSync,
} = require("../../models/layout");
const { asyncMap, isWeb } = require("../../utils");

/**
 * @param {object} req
 * @returns {Workflow}
 */
const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Layout"),
        builder: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = (await table.getFields()).filter(
            (f) => !f.primary_key
          );
          for (const field of fields) {
            if (field.type === "Key") {
              field.reftable = await Table.findOne({
                name: field.reftable_name,
              });
              if (field.reftable) await field.reftable.getFields();
            }
          }

          const { field_view_options, handlesTextStyle, blockDisplay } =
            calcfldViewOptions(fields, "edit");
          const fieldViewConfigForms = await calcfldViewConfig(fields, true);

          const roles = await User.get_roles();
          const images = await File.find({ mime_super: "image" });

          const actions = [
            "Save",
            "SaveAndContinue",
            "Reset",
            "GoBack",
            "Delete",
          ];
          const actionConfigForms = {
            Delete: [
              {
                name: "after_delete_url",
                label: req.__("URL after delete"),
                type: "String",
              },
            ],
            GoBack: [
              {
                name: "save_first",
                label: req.__("Save before going back"),
                type: "Bool",
              },
              {
                name: "reload_after",
                label: req.__("Reload after going back"),
                type: "Bool",
              },
              {
                name: "steps",
                label: req.__("Steps to go back"),
                type: "Integer",
                default: 1,
              },
            ],
          };
          const views = await get_link_view_opts(table, context.viewname);
          if (table.name === "users") {
            actions.push("Login");
            actions.push("Sign up");
            Object.entries(getState().auth_methods).forEach(([k, v]) => {
              actions.push(`Login with ${k}`);
            });
            fields.push({
              name: "password",
              label: req.__("Password"),
              type: "String",
            });
            fields.push({
              name: "passwordRepeat",
              label: req.__("Password Repeat"),
              type: "String",
            });
            fields.push({
              name: "remember",
              label: req.__("Remember me"),
              type: "Bool",
            });

            field_view_options.password = ["password"];
            field_view_options.passwordRepeat = ["password"];
            field_view_options.remember = ["edit"];
          }
          const library = (await Library.find({})).filter((l) =>
            l.suitableFor("edit")
          );
          const myviewrow = await View.findOne({ name: context.viewname });
          const { parent_field_list } = await table.get_parent_relations(
            true,
            true
          );

          return {
            tableName: table.name,
            fields,
            field_view_options,
            parent_field_list,
            handlesTextStyle,
            blockDisplay,
            roles,
            actions,
            fieldViewConfigForms,
            actionConfigForms,
            images,
            min_role: (myviewrow || {}).min_role,
            library,
            views,
            mode: "edit",
          };
        },
      },
      {
        name: req.__("Fixed fields"),
        contextField: "fixed",
        onlyWhen: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const in_form_fields = context.columns.map((f) => f.field_name);
          return fields.some(
            (f) =>
              !in_form_fields.includes(f.name) &&
              !f.calculated &&
              !f.primary_key
          );
        },
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const in_form_fields = context.columns.map((f) => f.field_name);
          const omitted_fields = fields.filter(
            (f) =>
              !in_form_fields.includes(f.name) &&
              !f.calculated &&
              !f.primary_key
          );
          var formFields = [];
          omitted_fields.forEach((f) => {
            f.required = false;

            formFields.push(f);
            if (f.presets) {
              formFields.push(
                new Field({
                  name: "preset_" + f.name,
                  label: req.__("Preset %s", f.label),
                  type: "String",
                  attributes: { options: Object.keys(f.presets) },
                })
              );
            }
          });
          const form = new Form({
            blurb: req.__(
              "These fields were missing, you can give values here. The values you enter here can be overwritten by information coming from other views, for instance if the form is triggered from a list."
            ),
            fields: formFields,
          });
          await form.fill_fkey_options();
          return form;
        },
      },
      {
        name: req.__("Edit options"),
        onlyWhen: async (context) => {
          const done_views = await View.find_all_views_where(
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              (viewrow.table_id === context.table_id ||
                state_fields.every((sf) => !sf.required))
          );
          return done_views.length > 0;
        },
        form: async (context) => {
          const own_views = await View.find_all_views_where(
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              (viewrow.table_id === context.table_id ||
                state_fields.every((sf) => !sf.required))
          );
          const table = await Table.findOne({ id: context.table_id });
          const parent_views = await get_parent_views(table, context.viewname);

          const done_view_opts = own_views.map((v) => v.select_option);
          parent_views.forEach(({ relation, related_table, views }) =>
            views.forEach((v) => {
              done_view_opts.push(`${v.name}.${relation.name}`);
            })
          );
          return new Form({
            fields: [
              {
                name: "auto_save",
                label: req.__("Auto save"),
                sublabel: req.__("Save any changes immediately"),
                type: "Bool",
              },
              {
                name: "destination_type",
                label: "Destination type",
                type: "String",
                required: true,
                sublabel: req.__(
                  "This is the view to which the user will be sent when the form is submitted. The view you specify here can be ignored depending on the context of the form, for instance if it appears in a pop-up the redirect will not take place."
                ),
                //fieldview: "radio_group",
                attributes: {
                  options: ["View", "Formula", "Back to referer"],
                },
              },
              {
                name: "view_when_done",
                label: req.__("Destination view"),
                type: "String",
                required: true,
                attributes: {
                  options: done_view_opts,
                },
                showIf: { destination_type: "View" },
              },

              new FieldRepeat({
                name: "formula_destinations",
                showIf: { destination_type: "Formula" },
                fields: [
                  {
                    type: "String",
                    name: "expression",
                    label: "Formula",
                    sublabel:
                      "if this formula evaluates to true, use the following view",
                  },
                  {
                    name: "view",
                    label: req.__("View"),
                    type: "String",
                    required: true,
                    attributes: {
                      options: done_view_opts,
                    },
                  },
                ],
              }),
            ],
          });
        },
      },
    ],
  });

/**
 * @param {*} table_id
 * @param {*} viewname
 * @param {object} opts
 * @param {*} opts.columns
 * @returns {Promise<object[]>}
 */
const get_state_fields = async (table_id, viewname, { columns }) => [
  {
    name: "id",
    type: "Integer",
    primary_key: true,
  },
];

/**
 * @param {Form} form
 * @param {string} locale
 */
const setDateLocales = (form, locale) => {
  form.fields.forEach((f) => {
    if (f.type && f.type.name === "Date") {
      f.attributes.locale = locale;
    }
  });
};

/** @type {function} */
const initial_config = initial_config_all_fields(true);

/**
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} optsOne
 * @param {*} optsOne.columns
 * @param {*} optsOne.layout
 * @param {string} state
 * @param {object} optsTwo
 * @param {object} optsTwo.req
 * @param {object} optsTwo.res
 * @returns {Promise<Form>}
 */
const run = async (
  table_id,
  viewname,
  {},
  state,
  { res, req },
  { editQuery }
) => {
  return await editQuery(state);
};

/**
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} opts
 * @param {*} opts.columns
 * @param {*} opts.layout
 * @param {State} state
 * @param {object} extra
 * @returns {Promise<Form[]>}
 */
const runMany = async (
  table_id,
  viewname,
  { columns, layout, auto_save },
  state,
  extra,
  { editManyQuery, getRowQuery }
) => {
  const { table, fields, rows } = editManyQuery();
  return await asyncMap(rows, async (row) => {
    const html = await render({
      table,
      fields,
      viewname,
      columns,
      layout,
      row,
      req: extra.req,
      res: extra.res,
      state,
      auto_save,
      getRowQuery,
    });
    return { html, row };
  });
};

/**
 * @param {object} opts
 * @param {Form} opts.form
 * @param {Table} opts.table
 * @param {object} opts.req
 * @param {object} opts.row
 * @param {object} opts.res
 * @throws {InvalidConfiguration}
 * @returns {Promise<void>}
 */
const transformForm = async ({ form, table, req, row, res, getRowQuery }) => {
  await traverse(form.layout, {
    action(segment) {
      if (segment.action_name === "Delete") {
        if (form.values && form.values.id) {
          segment.action_url = `/delete/${table.name}/${form.values.id}`;
        } else {
          segment.type = "blank";
          segment.contents = "";
        }
      }
    },
    join_field(segment) {
      const qs = objToQueryString(segment.configuration);
      segment.sourceURL = `/field/show-calculated/${table.name}/${segment.join_field}/${segment.fieldview}?${qs}`;
    },
    async view(segment) {
      //console.log(segment);
      const view_select = parse_view_select(segment.view);
      //console.log({ view_select });

      const view = await View.findOne({ name: view_select.viewname });
      if (!view)
        throw new InvalidConfiguration(
          `Cannot find embedded view: ${view_select.viewname}`
        );
      if (view.viewtemplate === "Edit" && view_select.type === "ChildList") {
        const childTable = Table.findOne({ id: view.table_id });
        const childForm = await getForm(
          childTable,
          view.name,
          view.configuration.columns,
          view.configuration.layout,
          row?.id,
          req
        );
        traverseSync(childForm.layout, {
          field(segment) {
            segment.field_name = `${view_select.field_name}.${segment.field_name}`;
          },
        });

        const fr = new FieldRepeat({
          name: view_select.field_name,
          label: view_select.field_name,
          fields: childForm.fields,
          layout: childForm.layout,
          metadata: {
            table_id: childTable.id,
            relation: view_select.field_name,
          },
        });
        if (row?.id) {
          const childRows = getRowQuery
            ? await getRowQuery(view.table_id, view_select, row.id)
            : await childTable.getRows({
                [view_select.field_name]: row.id,
              });
          fr.metadata.rows = childRows;
          if (!fr.fields.map((f) => f.name).includes(childTable.pk_name))
            fr.fields.push({
              name: childTable.pk_name,
              input_type: "hidden",
            });
        }
        form.fields.push(fr);
        segment.type = "field_repeat";
        segment.field_repeat = fr;
        return;
      }

      if (!row) {
        segment.type = "blank";
        segment.contents = "";
        return;
      }
      if (!view)
        throw new InvalidConfiguration(
          `Edit view incorrectly configured: cannot find embedded view ${view_select.viewname}`
        );
      let state;
      switch (view_select.type) {
        case "Own":
          state = { id: row.id };
          break;
        case "Independent":
          state = {};
          break;
        case "ChildList":
        case "OneToOneShow":
          state = { [view_select.field_name]: row.id };
          break;
        case "ParentShow":
          state = { id: row[view_select.field_name] };
          break;
      }
      segment.contents = await view.run(state, { req, res });
    },
  });
  translateLayout(form.layout, req.getLocale());

  if (req.xhr) form.xhrSubmit = true;
  setDateLocales(form, req.getLocale());
};

/**
 * @param {object} opts
 * @param {Table} opts.table
 * @param {Fields[]} opts.fields
 * @param {string} opts.viewname
 * @param {object[]} opts.columns
 * @param {Layout} opts.layout
 * @param {object} opts.row
 * @param {object} opts.req
 * @param {object} opts.state
 * @param {object} opts.res
 * @returns {Promise<Form>}
 */
const render = async ({
  table,
  fields,
  viewname,
  columns,
  layout,
  row,
  req,
  state,
  res,
  auto_save,
  destination_type,
  isRemote,
  getRowQuery,
}) => {
  const form = await getForm(
    table,
    viewname,
    columns,
    layout,
    state.id,
    req,
    isRemote
  );
  if (auto_save)
    form.onChange = `saveAndContinue(this, ${
      !isWeb(req) ? `'${form.action}'` : undefined
    })`;
  if (row) {
    form.values = row;
    const file_fields = form.fields.filter((f) => f.type === "File");
    for (const field of file_fields) {
      if (row[field.name]) {
        const file = await File.findOne({ id: row[field.name] });
        form.values[field.name] = file.filename;
      }
    }
    form.hidden(table.pk_name);
  }

  if (destination_type === "Back to referer") {
    form.hidden("_referer");
    form.values._referer = req.headers?.referer;
  }
  Object.entries(state).forEach(([k, v]) => {
    const field = form.fields.find((f) => f.name === k);
    if (field && ((field.type && field.type.read) || field.is_fkey)) {
      form.values[k] = field.type.read ? field.type.read(v) : v;
    } else {
      const tbl_field = fields.find((f) => f.name === k);
      if (tbl_field && !field) {
        form.fields.push(new Field({ name: k, input_type: "hidden" }));
        form.values[k] = tbl_field.type.read ? tbl_field.type.read(v) : v;
      }
    }
  });
  await form.fill_fkey_options();
  await transformForm({ form, table, req, row, res, getRowQuery });
  return renderForm(form, !isRemote ? req.csrfToken() : false);
};

/**
 * @param {number} table_id
 * @param {string} viewname
 * @param {object} optsOne
 * @param {object[]} optsOne.columns
 * @param {Layout} optsOne.layout
 * @param {object} optsOne.fixed
 * @param {boolean} optsOne.view_when_done
 * @param {object[]} optsOne.formula_destinations
 * @param {object} state
 * @param {*} body
 * @param {object} optsTwo
 * @param {object} optsTwo.res
 * @param {object} optsTwo.req
 * @param {string} optsTwo.redirect
 * @returns {Promise<void>}
 */
const runPost = async (
  table_id,
  viewname,
  {
    columns,
    layout,
    fixed,
    view_when_done,
    formula_destinations,
    auto_save,
    destination_type,
  },
  state,
  body,
  { res, req, redirect },
  { tryInsertQuery, tryUpdateQuery, getRowQuery }
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  const form = await getForm(table, viewname, columns, layout, body.id, req);
  if (auto_save) form.onChange = `saveAndContinue(this, ${
    !isWeb(req) ? `'${form.action}'` : undefined
  })`;

  Object.entries(body).forEach(([k, v]) => {
    const form_field = form.fields.find((f) => f.name === k);
    const tbl_field = fields.find((f) => f.name === k);
    if (tbl_field && !form_field) {
      form.fields.push(new Field({ name: k, input_type: "hidden" }));
    }
  });
  setDateLocales(form, req.getLocale());
  await transformForm({
    form,
    table,
    req,
    row: body[table.pk_name]
      ? { [table.pk_name]: body[table.pk_name] }
      : undefined,
    getRowQuery,
  });
  form.validate(body);
  if (form.hasErrors) {
    if (req.xhr) res.status(422);
    await form.fill_fkey_options();
    res.sendWrap(
      viewname,
      renderForm(form, req.csrfToken ? req.csrfToken() : false)
    );
  } else {
    let row;
    const pk = fields.find((f) => f.primary_key);
    let id = pk.type.read(body[pk.name]);
    if (typeof id === "undefined") {
      const use_fixed = await fill_presets(table, req, fixed);
      row = { ...use_fixed, ...form.values };
    } else {
      row = { ...form.values };
    }

    for (const field of form.fields.filter((f) => f.isRepeat)) {
      delete row[field.name];
    }

    const file_fields = form.fields.filter((f) => f.type === "File");
    for (const field of file_fields) {
      if (req.files && req.files[field.name]) {
        const file = await File.from_req_files(
          req.files[field.name],
          req.user ? req.user.id : null,
          (field.attributes && +field.attributes.min_role_read) || 1
        );
        row[field.name] = file.id;
      } else {
        delete row[field.name];
      }
    }
    const originalID = id;
    if (typeof id === "undefined") {
      const ins_res = await tryInsertQuery(row);
      if (ins_res.success) {
        id = ins_res.success;
        row[pk.name] = id;
      } else {
        req.flash("error", text_attr(ins_res.error));
        res.sendWrap(
          viewname,
          renderForm(form, req.csrfToken ? req.csrfToken() : false)
        );
        return;
      }
    } else {
      const upd_res = await tryUpdateQuery(row, id);
      if (upd_res.error) {
        req.flash("error", text_attr(upd_res.error));
        res.sendWrap(viewname, renderForm(form, req.csrfToken()));
        return;
      }
    }

    for (const field of form.fields.filter((f) => f.isRepeat)) {
      const childTable = Table.findOne({ id: field.metadata?.table_id });
      for (const childRow of form.values[field.name]) {
        childRow[field.metadata?.relation] = id;
        if (childRow[childTable.pk_name]) {
          const upd_res = await childTable.tryUpdateRow(
            childRow,
            childRow[childTable.pk_name]
          );
          if (upd_res.error) {
            req.flash("error", text_attr(upd_res.error));
            res.sendWrap(viewname, renderForm(form, req.csrfToken()));
            return;
          }
        } else {
          const ins_res = await childTable.tryInsertRow(
            childRow,
            req.user ? +req.user.id : undefined
          );
          if (ins_res.error) {
            req.flash("error", text_attr(ins_res.error));
            res.sendWrap(viewname, renderForm(form, req.csrfToken()));
            return;
          }
        }
      }
    }
    if (req.xhr && !originalID && !req.smr) {
      res.json({ id, view_when_done });
      return;
    }
    if (redirect) {
      res.redirect(redirect);
      return;
    }

    let use_view_when_done = view_when_done;
    if (destination_type === "Back to referer" && body._referer) {
      res.redirect(body._referer);
      return;
    } else if (destination_type !== "View")
      for (const { view, expression } of formula_destinations || []) {
        if (expression) {
          const f = get_expression_function(expression, fields);
          if (f(row)) {
            use_view_when_done = view;
            continue;
          }
        }
      }
    if (!use_view_when_done) {
      res.redirect(`/`);
      return;
    }
    const [viewname_when_done, relation] = use_view_when_done.split(".");
    const nxview = await View.findOne({ name: viewname_when_done });
    if (!nxview) {
      req.flash(
        "warning",
        `View "${use_view_when_done}" not found - change "View when done" in "${viewname}" view`
      );
      res.redirect(`/`);
    } else {
      const state_fields = await nxview.get_state_fields();
      let target = `/view/${text(viewname_when_done)}`;
      let query = "";
      if (
        (nxview.table_id === table_id || relation) &&
        state_fields.some((sf) => sf.name === pk.name)
      ) {
        const get_query = get_view_link_query(fields);
        query = relation
          ? `?${pk.name}=${text(row[relation])}`
          : get_query(row);
      }
      const redirectPath = `${target}${query}`;
      if (!isWeb(req)) {
        res.json({ redirect: `get${redirectPath}` });
      } else {
        res.redirect(redirectPath);
      }
    }
  }
};

const doAuthPost = async ({ body, table_id, req }) => {
  const table = await Table.findOne({ id: table_id });
  const user_id = req.user ? req.user.id : null;
  if (table.ownership_field_id && user_id) {
    const field_name = await table.owner_fieldname();
    if (typeof body[field_name] === "undefined") {
      const fields = await table.getFields();
      const { uniques } = splitUniques(fields, body);
      if (Object.keys(uniques).length > 0) {
        body = await table.getRow(uniques);
        return table.is_owner(req.user, body);
      }
    } else return field_name && `${body[field_name]}` === `${user_id}`;
  }
  if (table.ownership_formula && user_id) {
    return await table.is_owner(req.user, body);
  }
  if (table.name === "users" && `${body.id}` === `${user_id}`) return true;
  return false;
};

/**
 * @param {object} opts
 * @param {object} opts.body
 * @param {string} opts.table_id
 * @param {object} opts.req
 * @returns {Promise<boolean>}
 */
const authorise_post = async (
  { body, table_id, req },
  { authorizePostQuery }
) => {
  return await authorizePostQuery(body, table_id);
};
module.exports = {
  /** @type {string} */
  name: "Edit",
  /** @type {string} */
  description: "Form for creating a new row or editing existing rows",
  configuration_workflow,
  run,
  runMany,
  runPost,
  get_state_fields,
  initial_config,
  /** @type {boolean} */
  display_state_form: false,
  authorise_post,
  /**
   * @param {object} opts
   * @param {object} opts.query
   * @param {...*} opts.rest
   * @returns {Promise<boolean>}
   */
  authorise_get: async ({ query, table_id, req }, { authorizeGetQuery }) => {
    return await authorizeGetQuery(query, table_id);
  },
  /**
   * @param {object} opts
   * @param {Layout} opts.layout
   * @returns {string[]}
   */
  getStringsForI18n({ layout }) {
    return getStringsForI18n(layout);
  },
  queries: ({
    table_id,
    name,
    configuration: {
      columns,
      default_state,
      layout,
      auto_save,
      destination_type,
    },
    req,
    res,
  }) => ({
    async editQuery(state) {
      const table = await Table.findOne({ id: table_id });
      const fields = await table.getFields();
      const { uniques } = splitUniques(fields, state);
      let row = null;
      if (Object.keys(uniques).length > 0) {
        row = await table.getRow(uniques);
      }
      const isRemote = !isWeb(req);
      return await render({
        table,
        fields,
        viewname: name,
        columns,
        layout,
        row,
        req,
        res,
        state,
        auto_save,
        destination_type,
        isRemote,
      });
    },

    async editManyQuery(state) {
      const table = await Table.findOne({ id: table_id });
      const fields = await table.getFields();
      const { joinFields, aggregations } = picked_fields_to_query(
        columns,
        fields
      );
      const qstate = await stateFieldsToWhere({ fields, state });
      const q = await stateFieldsToQuery({ state, fields });

      const rows = await table.getJoinedRows({
        where: qstate,
        joinFields,
        aggregations,
        ...(extra && extra.limit && { limit: extra.limit }),
        ...(extra && extra.offset && { offset: extra.offset }),
        ...(extra && extra.orderBy && { orderBy: extra.orderBy }),
        ...(extra && extra.orderDesc && { orderDesc: extra.orderDesc }),
        ...q,
      });
      return {
        table,
        fields,
        rows,
      };
    },
    async tryInsertQuery(row) {
      const table = await Table.findOne({ id: table_id });
      const ins_res = await table.tryInsertRow(
        row,
        req.user ? +req.user.id : undefined
      );
      return ins_res;
    },

    async tryUpdateQuery(row, id) {
      const table = await Table.findOne({ id: table_id });
      const upd_res = await table.tryUpdateRow(
        row,
        id,
        req.user ? +req.user.id : undefined
      );
      return upd_res;
    },

    async authorizePostQuery(body, table_id /*overwrites*/) {
      return await doAuthPost({ body, table_id, req });
    },
    async authorizeGetQuery(query, table_id) {
      let body = query || {};
      if (Object.keys(body).length == 1) {
        const table = await Table.findOne({ id: table_id });
        if (table.ownership_field_id || table.ownership_formula) {
          const fields = await table.getFields();
          const { uniques } = splitUniques(fields, body);
          if (Object.keys(uniques).length > 0) {
            body = await table.getRow(uniques);
            return table.is_owner(req.user, body);
          }
        }
      }
      return doAuthPost({ body, table_id, req });
    },
    async getRowQuery(table_id, view_select, row_id) {
      const childTable = Table.findOne({ id: table_id });
      return await childTable.getRows({
        [view_select.field_name]: row_id,
      });
    },
  }),
  configCheck: async (view) => {
    const {
      name,
      configuration: { view_when_done, destination_type, formula_destinations },
    } = view;
    const errs = [];
    if (destination_type !== "Back to referer") {
      const vwd = await View.findOne({
        name: (view_when_done || "").split(".")[0],
      });
      if (!vwd)
        errs.push(
          `In View ${name}, view when done ${view_when_done} not found`
        );
      for (const { expression } of formula_destinations || []) {
        if (expression)
          expressionChecker(
            expression,
            `In View ${name}, destination formula ${expression} error: `,
            errs
          );
      }
    }
    errs.push(...(await check_view_columns(view, view.configuration.columns)));
    return errs;
  },
};
