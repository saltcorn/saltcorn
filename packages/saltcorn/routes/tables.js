const Router = require("express-promise-router");

const db = require("../db");
const { mkTable, mkForm, wrap, h, link, post_btn } = require("./markup.js");
const { sqlsanitize } = require("./utils.js");

// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get("/new/", async (req, res) => {
  res.send(
    wrap(
      `New table`,
      mkForm(
        "/table",
        [
          { label: "Name", name: "name", input_type: "text" },
        ]
      )
    )
  );

})
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const tq = await db.query("SELECT * FROM tables WHERE id = $1", [id]);
  const table = tq.rows[0];

  const fq = await db.query("SELECT * FROM fields WHERE table_id = $1", [id]);
  const fields = fq.rows;

  res.send(
    wrap(
      `${table.name} table`,
      h(1, table.name),
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
    )
  );
});


router.post("/", async (req, res) => {
  const v = req.body;
  if (typeof v.id === "undefined") {
    // insert
    await db.query(
      `create table ${sqlsanitize(v.name)} (id serial primary key)`      
    );
    await db.query(
      "insert into tables(name) values($1)",
      [v.name]
    );
  } else {

    //TODO RENAME TABLE
    await db.query(
      "update tables set name=$1 where id=$2",
      [v.name, v.id]
    );
  }
  res.redirect(`/table/`);
});

router.post("/delete/:id", async (req, res) => {
  const { id } = req.params;
  await db.query("delete FROM fields WHERE table_id = $1", [id]);
  
  const {
    rows
  } = await db.query("delete FROM tables WHERE id = $1 returning *", [id]);
  await db.query(
    `drop table ${sqlsanitize(rows[0].name)}`      
  );
  res.redirect(`/table`);
});

router.get("/", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM tables");
  res.send(
    wrap(
      "Tables",
      h(1, "Tables"),
      mkTable(
        [
          { label: "ID", key: "id" },
          { label: "Name", key: "name" },
          { label: "View", key: r => link(`/table/${r.id}`, "Edit") },
          { label: "Delete", key: r => post_btn(`/table/delete/${r.id}`, "Delete") }
        ],
        rows
      ),
      link(`/table/new`, "Add table")
    )
  );
});
