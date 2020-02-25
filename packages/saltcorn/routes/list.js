const Router = require("express-promise-router");

const db = require("../db");
const { mkTable, mkForm, wrap, h, link, post_btn } = require("./markup.js");
const { sqlsanitize } = require("./utils.js");
const Field = require("./field");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get("/:tname", async (req, res) => {
  const { tname } = req.params;
  const table = await db.get_table_by_name(tname);

  const fields = await Field.get_by_table_id(table.id);
  var tfields = fields.map(f => ({ label: f.label, key: f.name }));
  tfields.push({
    label: "Edit",
    key: r => link(`/edit/${table.name}/${r.id}`, "Edit")
  });
  tfields.push({
    label: "Delete",
    key: r => post_btn(`/delete/${table.name}/${r.id}`, "Delete")
  });
  const rows = await db.select(table.name);
  res.send(
    wrap(
      `${table.name} data table`,
      h(1, table.name),
      mkTable(tfields, rows),
      link(`/edit/${table.name}`, "Add row")
    )
  );
});
