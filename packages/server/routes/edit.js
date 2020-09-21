const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
const Form = require("@saltcorn/data/models/form");
const { setTenant, loggedIn, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const pluralize = require("pluralize");

const { renderForm } = require("@saltcorn/markup");

const router = new Router();
module.exports = router;

const files_to_dropdown = (fields) => {
  return fields.map((f) => {
    if (f.type === "File") f.attributes = { select_file_where: {} };
    return f;
  });
};

router.get(
  "/:tname",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const { tname } = req.params;
    const table = await Table.findOne({ name: tname });
    const fields = await Field.find({ table_id: table.id });
    const fields_dropfiles = files_to_dropdown(fields);
    const form = new Form({
      action: `/edit/${tname}`,
      fields: fields_dropfiles,
    });
    await form.fill_fkey_options();
    res.sendWrap(req.__(`New %s`, table.name), {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: req.__("Data"), href: `/list/${table.name}` },
            { text: req.__("Add row") },
          ],
        },
        ,
        {
          type: "card",
          title: req.__(`Add %s`, pluralize(table.name, 1)),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);

router.get(
  "/:tname/:id",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const { tname, id } = req.params;
    const table = await Table.findOne({ name: tname });

    const fields = await Field.find({ table_id: table.id });
    const row = await table.getRow({ id });
    const fields_dropfiles = files_to_dropdown(fields);
    const form = new Form({
      action: `/edit/${tname}`,
      values: row,
      fields: fields_dropfiles,
    });
    form.hidden("id");
    await form.fill_fkey_options();

    res.sendWrap(`Edit ${table.name}`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: req.__("Tables"), href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: req.__("Data"), href: `/list/${table.name}` },
            { text: req.__("Edit row") },
          ],
        },
        {
          type: "card",
          title: req.__(`Edit %s`, pluralize(table.name, 1)),
          contents: renderForm(form, req.csrfToken()),
        },
      ],
    });
  })
);

router.post(
  "/:tname",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const { tname } = req.params;
    const table = await Table.findOne({ name: tname });

    const fields = await Field.find({ table_id: table.id });
    const v = req.body;
    const fields_dropfiles = files_to_dropdown(fields);

    const form = new Form({
      action: `/edit/${tname}`,
      fields: fields_dropfiles,
    });
    if (typeof v.id !== "undefined") form.hidden("id");
    form.validate(v);
    if (form.hasErrors) {
      res.sendWrap(
        req.__(`Create new %s`, table.name),
        renderForm(form, req.csrfToken())
      ); // vres.errors.join("\n"));
    } else {
      if (typeof v.id === "undefined") {
        const ins_res = await table.tryInsertRow(
          form.values,
          req.user ? +req.user.id : undefined
        );
        if (ins_res.error) {
          req.flash("error", ins_res.error);
          res.sendWrap(
            req.__(`Create new %s`, table.name),
            renderForm(form, req.csrfToken())
          );
        } else res.redirect(`/list/${table.name}`);
      } else {
        const id = v.id;
        const upd_res = await table.tryUpdateRow(
          form.values,
          parseInt(id),
          req.user ? +req.user.id : undefined
        );
        if (upd_res.error) {
          req.flash("error", upd_res.error);
          res.sendWrap(
            req.__(`Create new %s`, table.name),
            renderForm(form, req.csrfToken())
          );
        } else res.redirect(`/list/${table.name}`);
      }
    }
  })
);

router.post(
  "/toggle/:name/:id/:field_name",
  setTenant,
  error_catcher(async (req, res) => {
    const { name, id, field_name } = req.params;
    const { redirect } = req.query;
    const table = await Table.findOne({ name });
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    if (role <= table.min_role_write) await table.toggleBool(+id, field_name);
    else
      req.flash(
        "error",
        req.__("Not allowed to write to table %s", table.name)
      );
    if (req.get("referer")) res.redirect(req.get("referer"));
    else res.redirect(redirect || `/list/${table.name}`);
  })
);
