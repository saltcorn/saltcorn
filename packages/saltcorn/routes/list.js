const Router = require("express-promise-router");

const db = require("../db");
const { mkTable, mkForm, wrap, h, link, post_btn } = require("./markup.js");
const { sqlsanitize } = require("./utils.js");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;


router.get("/:tname", async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await db.get_fields_by_table_id(table.id);
  const tfields=fields.map((f)=>({label: f.flabel, key: f.fname}))
  const { rows } = await db.query(`select * from ${sqlsanitize(table.name)}`)
  res.send(
    wrap(
      `${table.name} data table`,
      h(1, table.name),
      mkTable(
        tfields,
        rows
      ),
      link(`/edit/${table.name}`, "Add row")
    )
  );
});
