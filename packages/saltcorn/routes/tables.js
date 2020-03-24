const Router = require("express-promise-router");

const db = require("saltcorn-data/db");
const Table = require("saltcorn-data/models/table");
const Field = require("saltcorn-data/models/field");
const { mkTable, renderForm, h, link, post_btn } = require("saltcorn-markup");
const { isAdmin } = require("./utils.js");
const Form = require("saltcorn-data/models/form");
const { span } = require("saltcorn-markup/tags");

const router = new Router();
module.exports = router;

const tableForm = () =>
  new Form({
    action: "/table",
    fields: [new Field({ label: "Name", name: "name", input_type: "text" })]
  });

router.get("/new/", isAdmin, async (req, res) => {
  res.sendWrap(`New table`, renderForm(tableForm()));
});
router.get("/:id", isAdmin, async (req, res) => {
  const { id } = req.params;
  const table = await db.get_table_by_id(id);

  const fq = await db.query("SELECT * FROM fields WHERE table_id = $1", [id]);
  const fields = fq.rows;

  res.sendWrap(
    `${table.name} table`,

    mkTable(
      [
        { label: "Name", key: "name" },
        { label: "Label", key: "label" },
        { label: "Type", key: "type" },
        { label: "Edit", key: r => link(`/field/${r.id}`, "Edit") },
        {
          label: "Delete",
          key: r => post_btn(`/field/delete/${r.id}`, "Delete")
        }
      ],
      fields
    ),
    span({ class: "mr-3" }, link(`/list/${table.name}`, "List")),
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
  const t = await Table.findOne({ id });
  await t.delete();
  req.flash("success", "Table deleted");

  res.redirect(`/table`);
});

router.get("/", isAdmin, async (req, res) => {
  const { rows } = await db.query("SELECT * FROM tables");
  res.sendWrap(
    "Tables",
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
