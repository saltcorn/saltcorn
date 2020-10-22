const Field = require("../../models/field");
const File = require("../../models/file");
const FieldRepeat = require("../../models/fieldrepeat");
const Table = require("../../models/table");
const User = require("../../models/user");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
const { text } = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");
const {
  initial_config_all_fields,
  calcfldViewOptions,
} = require("../../plugin-helper");
const { splitUniques } = require("./viewable_fields");
const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Layout"),
        builder: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = (await table.getFields()).filter((f) => !f.calculated);

          const field_view_options = calcfldViewOptions(fields, true);

          const roles = await User.get_roles();
          const images = await File.find({ mime_super: "image" });

          const actions = [
            "Save",
            //"Delete"
          ];
          return {
            fields,
            field_view_options,
            roles,
            actions,
            images,
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
            (f) => !in_form_fields.includes(f.name) && !f.calculated
          );
        },
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const in_form_fields = context.columns.map((f) => f.field_name);
          const omitted_fields = fields.filter(
            (f) => !in_form_fields.includes(f.name) && !f.calculated
          );
          var formFields = [];
          omitted_fields.forEach((f) => {
            if (f.presets) {
              f.required = false;
            }
            formFields.push(f);
            if (f.presets) {
              formFields.push(
                new Field({
                  name: "preset_" + f.name,
                  label: "Preset " + f.label,
                  type: "String",
                  attributes: { options: Object.keys(f.presets).join() },
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
          const done_views = await View.find_all_views_where(
            ({ state_fields, viewrow }) =>
              viewrow.name !== context.viewname &&
              (viewrow.table_id === context.table_id ||
                state_fields.every((sf) => !sf.required))
          );
          const done_view_opts = done_views.map((v) => v.name);

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
                  options: done_view_opts.join(),
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
  },
];

const getForm = async (table, viewname, columns, layout, id) => {
  const fields = await table.getFields();

  const tfields = (columns || [])
    .map((column) => {
      if (column.type === "Field") {
        const f = fields.find((fld) => fld.name === column.field_name);
        if (f) {
          f.fieldview = column.fieldview;
          return f;
        }
      }
    })
    .filter((tf) => !!tf);

  const form = new Form({
    action: `/view/${viewname}`,
    fields: tfields,
    layout,
  });
  await form.fill_fkey_options();
  if (id) form.hidden("id");
  return form;
};

const setDateLocales = (form, locale) => {
  form.fields.forEach((f) => {
    if (f.type && f.type.name === "Date") {
      f.attributes.locale = locale;
    }
  });
};

const initial_config = initial_config_all_fields(true);

const run = async (table_id, viewname, config, state, { res, req }) => {
  const { columns, layout } = config;
  //console.log(JSON.stringify(layout, null,2))
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  const form = await getForm(table, viewname, columns, layout, state.id);
  const { uniques, nonUniques } = splitUniques(fields, state);
  if (Object.keys(uniques).length > 0) {
    const row = await table.getRow(uniques);
    form.values = row;
    const file_fields = form.fields.filter((f) => f.type === "File");
    for (const field of file_fields) {
      if (row[field.name]) {
        const file = await File.findOne({ id: row[field.name] });
        form.values[field.name] = file.filename;
      }
    }
    form.hidden("id");
  }
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
  if (req.xhr) form.xhrSubmit = true;
  setDateLocales(form, req.getLocale());
  return renderForm(form, req.csrfToken());
};

const fill_presets = async (table, req, fixed) => {
  const fields = await table.getFields();
  Object.keys(fixed || {}).forEach((k) => {
    if (k.startsWith("preset_")) {
      if (fixed[k]) {
        const fldnm = k.replace("preset_", "");
        const fld = fields.find((f) => f.name === fldnm);
        fixed[fldnm] = fld.presets[fixed[k]]({ user: req.user });
      }
      delete fixed[k];
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
  { res, req }
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  const form = await getForm(table, viewname, columns, layout, body.id);
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
    if (req.xhr) {
      form.xhrSubmit = true;
      res.status(400);
    }
    res.sendWrap(viewname, renderForm(form, req.csrfToken()));
  } else {
    var row;
    var id = body.id;
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
        req.flash("error", ins_res.error);
        res.sendWrap(viewname, renderForm(form, req.csrfToken()));
        return;
      }
    } else {
      const upd_res = await table.tryUpdateRow(
        row,
        parseInt(id),
        req.user ? +req.user.id : undefined
      );
      if (upd_res.error) {
        req.flash("error", upd_res.error);
        res.sendWrap(viewname, renderForm(form, req.csrfToken()));
        return;
      }
    }

    if (!view_when_done) {
      res.redirect(`/`);
    } else {
      const nxview = await View.findOne({ name: view_when_done });
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
          nxview.table_id === table_id &&
          state_fields.some((sf) => sf.name === "id")
        )
          res.redirect(`/view/${text(view_when_done)}?id=${text(id)}`);
        else res.redirect(`/view/${text(view_when_done)}`);
      }
    }
  }
};

module.exports = {
  name: "Edit",
  configuration_workflow,
  run,
  runPost,
  get_state_fields,
  initial_config,
  display_state_form: false,
};
