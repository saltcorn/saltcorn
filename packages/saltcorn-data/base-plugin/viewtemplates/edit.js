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
  parse_view_select,
} = require("./viewable_fields");
const { traverse } = require("../../models/layout");
const { asyncMap } = require("../../utils");

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

          const { field_view_options, handlesTextStyle } = calcfldViewOptions(
            fields,
            true
          );
          const fieldViewConfigForms = await calcfldViewConfig(fields, true);

          const roles = await User.get_roles();
          const images = await File.find({ mime_super: "image" });

          const actions = ["Save", "Delete"];
          const actionConfigForms = {
            Delete: [
              {
                name: "after_delete_url",
                label: req.__("URL after delete"),
                type: "String",
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
          return {
            tableName: table.name,
            fields,
            field_view_options,
            handlesTextStyle,
            roles,
            actions,
            fieldViewConfigForms,
            actionConfigForms,
            images,
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
            blurb: req.__(
              "The view you choose here can be ignored depending on the context of the form, for instance if it appears in a pop-up the redirect will not take place."
            ),
            fields: [
              {
                name: "view_when_done",
                label: req.__("View when done"),
                type: "String",
                required: true,
                attributes: {
                  options: done_view_opts,
                },
              },
            ],
          });
        },
      },
    ],
  });
const get_state_fields = async (table_id, viewname, { columns }) => [
  {
    name: "id",
    type: "Integer",
    primary_key: true,
  },
];

const setDateLocales = (form, locale) => {
  form.fields.forEach((f) => {
    if (f.type && f.type.name === "Date") {
      f.attributes.locale = locale;
    }
  });
};

const initial_config = initial_config_all_fields(true);

const run = async (
  table_id,
  viewname,
  { columns, layout },
  state,
  { res, req }
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  const { uniques, nonUniques } = splitUniques(fields, state);
  let row = null;
  if (Object.keys(uniques).length > 0) {
    row = await table.getRow(uniques);
  }
  return await render({
    table,
    fields,
    viewname,
    columns,
    layout,
    row,
    req,
    res,
    state,
  });
};
const runMany = async (
  table_id,
  viewname,
  { columns, layout },
  state,
  extra
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
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
    });
    return { html, row };
  });
};

const transformForm = async ({ form, table, req, row, res }) => {
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
    async view(segment) {
      if (!row) {
        segment.type = "blank";
        segment.contents = "";
        return;
      }
      const view_select = parse_view_select(segment.view);
      const view = await View.findOne({ name: view_select.viewname });
      let state;
      switch (view_select.type) {
        case "Own":
          state = { id: row.id };
          break;
        case "ChildList":
          state = { [view_select.field_name]: row.id };
          break;
        case "ParentShow":
          state = { id: row[view_select.field_name] };
          break;
      }
      segment.contents = await view.run(state, { req, res });
    },
  });
  if (req.xhr) form.xhrSubmit = true;
  setDateLocales(form, req.getLocale());
};

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
}) => {
  const form = await getForm(table, viewname, columns, layout, state.id, req);

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

  const { nonUniques } = splitUniques(fields, state);
  Object.entries(nonUniques).forEach(([k, v]) => {
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
  await transformForm({ form, table, req, row, res });
  return renderForm(form, req.csrfToken());
};

const fill_presets = async (table, req, fixed) => {
  const fields = await table.getFields();
  Object.keys(fixed || {}).forEach((k) => {
    if (k.startsWith("preset_")) {
      if (fixed[k]) {
        const fldnm = k.replace("preset_", "");
        const fld = fields.find((f) => f.name === fldnm);
        fixed[fldnm] = fld.presets[fixed[k]]({ user: req.user, req });
      }
      delete fixed[k];
    } else {
      const fld = fields.find((f) => f.name === k);
      if (!fld) delete fixed[k];
    }
  });
  return fixed;
};

const runPost = async (
  table_id,
  viewname,
  { columns, layout, fixed, view_when_done },
  state,
  body,
  { res, req, redirect }
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  const form = await getForm(table, viewname, columns, layout, body.id, req);
  Object.entries(body).forEach(([k, v]) => {
    const form_field = form.fields.find((f) => f.name === k);
    const tbl_field = fields.find((f) => f.name === k);
    if (tbl_field && !form_field) {
      form.fields.push(new Field({ name: k, input_type: "hidden" }));
    }
  });
  setDateLocales(form, req.getLocale());
  form.validate(body);
  if (form.hasErrors) {
    if (req.xhr) res.status(422);
    await transformForm({ form, table, req });
    res.sendWrap(viewname, renderForm(form, req.csrfToken()));
  } else {
    var row;
    const pk = fields.find((f) => f.primary_key);
    let id = pk.type.read(body[pk.name]);
    if (typeof id === "undefined") {
      const use_fixed = await fill_presets(table, req, fixed);
      row = { ...use_fixed, ...form.values };
    } else {
      row = form.values;
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
    if (typeof id === "undefined") {
      const ins_res = await table.tryInsertRow(
        row,
        req.user ? +req.user.id : undefined
      );
      if (ins_res.success) id = ins_res.success;
      else {
        req.flash("error", text_attr(ins_res.error));
        res.sendWrap(viewname, renderForm(form, req.csrfToken()));
        return;
      }
    } else {
      const upd_res = await table.tryUpdateRow(
        row,
        id,
        req.user ? +req.user.id : undefined
      );
      if (upd_res.error) {
        req.flash("error", text_attr(upd_res.error));
        res.sendWrap(viewname, renderForm(form, req.csrfToken()));
        return;
      }
    }
    if (redirect) res.redirect(redirect);
    else if (!view_when_done) {
      res.redirect(`/`);
    } else {
      const [viewname_when_done, relation] = view_when_done.split(".");
      const nxview = await View.findOne({ name: viewname_when_done });
      //console.log()
      if (!nxview) {
        req.flash(
          "warning",
          `View "${view_when_done}" not found - change "View when done" in "${viewname}" view`
        );
        res.redirect(`/`);
      } else {
        const state_fields = await nxview.get_state_fields();
        if (
          (nxview.table_id === table_id || relation) &&
          state_fields.some((sf) => sf.name === pk.name)
        )
          res.redirect(
            `/view/${text(viewname_when_done)}?${pk.name}=${text(
              relation ? row[relation] : id
            )}`
          );
        else res.redirect(`/view/${text(viewname_when_done)}`);
      }
    }
  }
};
const authorise_post = async ({ body, table_id, req }) => {
  const table = await Table.findOne({ id: table_id });
  const user_id = req.user ? req.user.id : null;
  if (table.ownership_field_id && user_id) {
    const field_name = await table.owner_fieldname();
    return field_name && `${body[field_name]}` === `${user_id}`;
  }
  if (table.name === "users" && `${body.id}` === `${user_id}`) return true;
  return false;
};
module.exports = {
  name: "Edit",
  description: "Form for creating a new row or editing existing rows",
  configuration_workflow,
  run,
  runMany,
  runPost,
  get_state_fields,
  initial_config,
  display_state_form: false,
  authorise_post,
  authorise_get: async ({ query, ...rest }) =>
    authorise_post({ body: query, ...rest }),
};
