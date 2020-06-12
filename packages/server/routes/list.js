const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const { mkTable, h, link, post_btn } = require("@saltcorn/markup");
const Table = require("@saltcorn/data/models/table");
const { setTenant, loggedIn } = require("./utils");
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get("/:tname", setTenant, loggedIn, async (req, res) => {
  const { tname } = req.params;
  const table = await Table.findOne({ name: tname });

  const fields = await table.getFields();
  var tfields = fields.map(f => ({ label: f.label, key: f.listKey }));
  tfields.push({
    label: "Edit",
    key: r => link(`/edit/${table.name}/${r.id}`, "Edit")
  });
  tfields.push({
    label: "Delete",
    key: r =>
      post_btn(`/delete/${table.name}/${r.id}`, "Delete", req.csrfToken())
  });
  const rows = await table.getJoinedRows();
  res.sendWrap(
    `${table.name} data table`,
    mkTable(tfields, rows),
    link(`/edit/${table.name}`, "Add row")
  );
});
