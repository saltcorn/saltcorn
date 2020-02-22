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
    console.log("body",req.body)
    
    if(typeof(req.body.id)==="undefined") {


    } else {


    }

    res.send("thanks!")
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
