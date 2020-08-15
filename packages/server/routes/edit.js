const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { setTenant, loggedIn, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const pluralize = require("pluralize");

const { renderForm } = require("@saltcorn/markup");

const router = new Router();
module.exports = router;

//create -- new
router.get(
  "/:tname",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const { tname } = req.params;
    const table = await Table.findOne({ name: tname });
    const fields = await Field.find({ table_id: table.id });
    const form = new Form({ action: `/edit/${tname}`, fields });
    await form.fill_fkey_options();
    res.sendWrap(`New ${table.name}`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: "Tables", href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: "Data", href: `/list/${table.name}` },
            { text: "Add row" }
          ]
        },
        ,
        {
          type: "card",
          title: `Add ${pluralize(table.name, 1)}`,
          contents: renderForm(form, req.csrfToken())
        }
      ]
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
    const form = new Form({ action: `/edit/${tname}`, values: row, fields });
    form.hidden("id");
    await form.fill_fkey_options();

    res.sendWrap(`Edit ${table.name}`, {
      above: [
        {
          type: "breadcrumbs",
          crumbs: [
            { text: "Tables", href: "/table" },
            { href: `/table/${table.id}`, text: table.name },
            { text: "Data", href: `/list/${table.name}` },
            { text: "Edit row" }
          ]
        },
        {
          type: "card",
          title: `Edit ${pluralize(table.name, 1)}`,
          contents: renderForm(form, req.csrfToken())
        }
      ]
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

    const form = new Form({ action: `/edit/${tname}`, fields });
    if (typeof v.id !== "undefined") form.hidden("id");
    form.validate(v);
    if (form.hasErrors) {
      res.sendWrap(
        `${table.name} create new`,
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
            `${table.name} create new`,
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
            `${table.name} create new`,
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
    else req.flash("error", `Not allowed to write to table ${table.name}`);

    res.redirect(redirect || `/list/${table.name}`);
  })
);
