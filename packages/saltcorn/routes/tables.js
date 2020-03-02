const Router = require("express-promise-router");

const db = require("../db");
const Table = require("../db/table");
const { mkTable, mkForm, wrap, h, link, post_btn } = require("./markup.js");
const { sqlsanitize, isAdmin } = require("./utils.js");

const router = new Router();
module.exports = router;

router.get("/new/", isAdmin, async (req, res) => {
  res.sendWrap(
    `New table`,
    mkForm("/table", [{ label: "Name", name: "name", input_type: "text" }])
  );
});
router.get("/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const table = await db.get_table_by_id(id);

  const fq = await db.query("SELECT * FROM fields WHERE table_id = $1", [id]);
  const fields = fq.rows;

  res.sendWrap(
    `${table.name} table`,
    h(1, table.name),
    link(`/list/${table.name}`, "List"),
    mkTable(
      [
        { label: "Name", key: "fname" },
        { label: "Label", key: "flabel" },
        { label: "Type", key: "ftype" },
        { label: "Edit", key: r => link(`/field/${r.id}`, "Edit") },
        {
          label: "Delete",
          key: r => post_btn(`/field/delete/${r.id}`, "Delete")
        }
      ],
      fields
    ),
    link(`/field/new/${table.id}`, "Add field")
  );
});

router.post("/", isAdmin, async (req, res) => {
  const v = req.body;
  if (typeof v.id === "undefined") {
    // insert
    await Table.create(v.name);
    req.flash("success", "Table created");
  } else {
    //TODO RENAME TABLE
    await db.query("update tables set name=$1 where id=$2", [v.name, v.id]);
  }
  res.redirect(`/table/`);
});

router.post("/delete/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const t = await Table.find({ id });
  await t.delete();
  req.flash("success", "Table deleted");

  res.redirect(`/table`);
});

router.get("/", isAdmin, async (req, res) => {
  const { rows } = await db.query("SELECT * FROM tables");
  res.sendWrap(
    "Tables",
    h(1, "Tables"),
    mkTable(
      [
        { label: "Name", key: "name" },
        { label: "View", key: r => link(`/table/${r.id}`, "Edit") },
        {
          label: "Delete",
          key: r => post_btn(`/table/delete/${r.id}`, "Delete")
        }
      ],
      rows
    ),
    link(`/table/new`, "Add table")
  );
});
