const Router = require("express-promise-router");

const db = require("saltcorn-data/db");
const Field = require("saltcorn-data/models/field");
const Form = require("saltcorn-data/models/form");
const { loggedIn } = require("./utils.js");
const Table = require("saltcorn-data/models/table");

const {
  mkTable,
  renderForm,
  wrap,
  h,
  link,
  post_btn
} = require("saltcorn-markup");

const router = new Router();
module.exports = router;

//create -- new
router.get("/:tname", loggedIn, async (req, res) => {
  const { tname } = req.params;
  const table = await Table.findOne({name:tname});
  const fields = await Field.find({ table_id: table.id });
  const form = new Form({ action: `/edit/${tname}`, fields });
  await form.fill_fkey_options();
  res.sendWrap(`New ${table.name}`, renderForm(form));
});

router.get("/:tname/:id", loggedIn, async (req, res) => {
  const { tname, id } = req.params;
  const table = await Table.findOne({name:tname});

  const fields = await Field.find({ table_id: table.id });
  const row = await db.selectOne(table.name, { id: id });
  const form = new Form({ action: `/edit/${tname}`, values: row, fields });
  form.hidden("id");
  await form.fill_fkey_options();

  res.sendWrap(`Edit ${table.name}`, renderForm(form));
});

router.post("/:tname", loggedIn, async (req, res) => {
  const { tname } = req.params;
  const table = await Table.findOne({name:tname});

  const fields = await Field.find({ table_id: table.id });
  const v = req.body;

  const form = new Form({ action: `/edit/${tname}`, fields, validate: v });
  if (form.hasErrors) {
    res.sendWrap(`${table.name} create new`, renderForm(form)); // vres.errors.join("\n"));
  } else {
    if (typeof v.id === "undefined") {
      await db.insert(table.name, form.values);
    } else {
      const id = v.id;
      await db.update(table.name, form.values, id);
    }
    res.redirect(`/list/${table.name}`);
  }
});
