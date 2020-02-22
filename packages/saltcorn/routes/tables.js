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
  const { rows } = await db.query("SELECT * FROM tables WHERE id = $1", [id]);
  res.send(rows[0]);
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
