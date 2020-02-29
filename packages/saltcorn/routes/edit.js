const Router = require("express-promise-router");

const db = require("../db");
const Field = require("../db/field");

const { mkTable, mkForm, wrap, h, link, post_btn } = require("./markup.js");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

//create -- new
router.get("/:tname", async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);
  const fields = await Field.get_by_table_id(table.id);
  const tfields = fields.map(f => f.to_formfield);

  res.send(
    wrap(
      `${table.name} create new`,
      h(1, "New " + table.name),
      mkForm(`/edit/${tname}`, tfields)
    )
  );
});

router.get("/:tname/:id", async (req, res) => {
  const { tname, id } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await Field.get_by_table_id(table.id);
  const tfields = fields.map(f => f.to_formfield);
  tfields.push({
    name: "id",
    input_type: "hidden"
  });
  const row = await db.selectOne(table.name, { id: id });
  res.send(
    wrap(
      `${table.name} create new`,
      h(1, "Edit " + table.name),
      mkForm(`/edit/${tname}`, tfields, row)
    )
  );
});

router.post("/:tname", async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await Field.get_by_table_id(table.id);
  const v = req.body;

  var errors = [];
  fields.forEach(f => {
    const valres = f.validate(v[f.name]);
    if (valres.error) {
      errors.push(`${f.name}: ${valres.error}`);
    }
  });
  if (errors.length > 0) {
    res.send(wrap(`${table.name} create new`, errors.join("\n")));
  } else {
    if (typeof v.id === "undefined") {
      await db.insert(table.name, v);
    } else {
      const id = v.id;
      delete v.id;
      await db.update(table.name, v, id);
    }
    res.redirect(`/list/${table.name}`);
  }
});
