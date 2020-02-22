const Router = require("express-promise-router");

const db = require("../db");
const { mkTable, mkForm, wrap } = require("./markup.js");

// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const fq = await db.query("SELECT * FROM fields WHERE id = $1", [id]);
  const field = fq.rows[0];

  res.send(
    wrap(
      `Edit field`,
      mkForm("/field", [
        { name: "id", input_type: "hidden" },
        { name: "table_id", input_type: "hidden" },
        { label: "Name", name: "fname", input_type: "text" },
        { label: "Label", name: "flabel", input_type: "text" },
        { label: "Type", name: "ftype", input_type: "text" },
      ], field)
    )
  );
});

router.post("/", async (req, res) => {
    const v=req.body
    if(typeof(v.id)==="undefined") { // insert
        await db.query("insert into fields(table_id, fname, flabel, ftype) values($1,$2,$3,$4)",[v.table_id, v.fname, v.flabel, v.ftype]);
    } else {
        await db.query("update fields set table_id=$1, fname=$2, flabel=$3, ftype=$4 where id=$5",[v.table_id, v.fname, v.flabel, v.ftype, v.id]);
    }
    res.redirect(`/table/${v.table_id}`)
});

router.get("/", async (req, res) => {
  const { rows } = await db.query("SELECT * FROM tables");
  res.send(
    wrap(
      "Tables",
      mkTable(
        [
          { label: "ID", key: "id" },
          { label: "Name", key: "name" },
          { label: "View", key: r => `<a href="/table/${r.id}">Edit</a>` }
        ],
        rows
      )
    )
  );
});
