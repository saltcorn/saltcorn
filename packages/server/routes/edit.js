const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const Form = require("@saltcorn/data/models/form");
const { setTenant, loggedIn, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");

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
    res.sendWrap(`New ${table.name}`, renderForm(form, req.csrfToken()));
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

    res.sendWrap(`Edit ${table.name}`, renderForm(form, req.csrfToken()));
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

    const form = new Form({ action: `/edit/${tname}`, fields, validate: v });
    if (form.hasErrors) {
      res.sendWrap(
        `${table.name} create new`,
        renderForm(form, req.csrfToken())
      ); // vres.errors.join("\n"));
    } else {
      if (typeof v.id === "undefined") {
        await table.insertRow(form.values, req.user ? req.user.id : undefined);
      } else {
        const id = v.id;
        await table.updateRow(form.values, parseInt(id), req.user ? req.user.id : undefined);
      }
      res.redirect(`/list/${table.name}`);
    }
  })
);

router.post(
  "/toggle/:name/:id/:field_name",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const { name, id, field_name } = req.params;
    const { redirect } = req.query;
    const table = await Table.findOne({ name });
    await table.toggleBool(+id, field_name);

    res.redirect(redirect || `/list/${table.name}`);
  })
);
