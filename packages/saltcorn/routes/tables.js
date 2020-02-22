const Router = require("express-promise-router");

const db = require("../db");
const { mkTable, wrap } = require("./markup.js");

// create a new express-promise-router
// this has the same API as the normal express router except
// it allows you to use async functions as route handlers
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const tq = await db.query("SELECT * FROM tables WHERE id = $1", [id]);
  const table = tq.rows[0];

  const fq = await db.query("SELECT * FROM fields WHERE table_id = $1", [id]);
  const fields = fq.rows;

  res.send(
    wrap(
      `${table.name} table`,
      `<h1>${table.name}</h1>` +
        mkTable(
          [
            { label: "Name", key: "fname" },
            { label: "Label", key: "flabel" },
            { label: "Type", key: "ftype" },
            { label: "Edit", key: r => `<a href="/field/${r.id}">Edit</a>` }
          ],
          fields
        )+`<a href="/field/new/${table.id}">Add field</a>`
    )
  );
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
