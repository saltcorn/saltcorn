const Router = require("express-promise-router");

const db = require("../db");
const Field = require("../db/field");
const Form = require("../models/form");
const { loggedIn } = require("./utils.js");

const { mkTable, renderForm, wrap, h, link, post_btn } = require("./markup.js");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

//create -- new
router.get("/:tname", loggedIn, async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);
  const fields = await Field.get_by_table_id(table.id);
  const form = new Form({ action: `/edit/${tname}`, fields });

  res.sendWrap(
    `${table.name} create new`,
    h(1, "New " + table.name),
    renderForm(form)
  );
});

router.get("/:tname/:id", loggedIn, async (req, res) => {
  const { tname, id } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await Field.get_by_table_id(table.id);

  const row = await db.selectOne(table.name, { id: id });
  const form = new Form({ action: `/edit/${tname}`, values: row, fields });
  form.hidden("id");

  res.sendWrap(
    `${table.name} create new`,
    h(1, "Edit " + table.name),
    renderForm(form)
  );
});

router.post("/:tname", loggedIn, async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await Field.get_by_table_id(table.id);
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
