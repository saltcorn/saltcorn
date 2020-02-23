const Router = require("express-promise-router");

const db = require("../db");
const Field = require("./field");

const { mkTable, mkForm, wrap, h, link, post_btn } = require("./markup.js");
const { sqlsanitize } = require("./utils.js");

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
  const { rows } = await db.query(
    `select * from ${sqlsanitize(table.name)} where id = $1`,
    [id]
  );
  res.send(
    wrap(
      `${table.name} create new`,
      h(1, "Edit " + table.name),
      mkForm(`/edit/${tname}`, tfields, rows[0])
    )
  );
});

router.post("/:tname", async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await Field.get_by_table_id(table.id);
  const v = req.body;
  const fnameList = fields.map(f => sqlsanitize(f.name)).join();
  var valList = fields.map(f => v[f.name]);
  const valPosList = fields.map((f, ix) => "$" + (ix + 1)).join();
  if (typeof v.id === "undefined") {
    await db.query(
      `insert into ${sqlsanitize(
        table.name
      )}(${fnameList}) values(${valPosList})`,
      valList
    );
  } else {
    const assigns = fields
      .map((f, ix) => sqlsanitize(f.name) + "=$" + (ix + 1))
      .join();
    valList.push(v.id);
    const q = `update ${sqlsanitize(
      table.name
    )} set ${assigns} where id=$${fields.length + 1}`;
    await db.query(q, valList);
  }
  res.redirect(`/list/${table.name}`);
});
