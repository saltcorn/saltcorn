const Router = require("express-promise-router");

const db = require("saltcorn-data/db");
const { loggedIn } = require("./utils.js");
const Table = require("saltcorn-data/models/table");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.post("/:tname/:id", loggedIn, async (req, res) => {
  const { tname, id } = req.params;
  const { redirect } = req.query;
  const table = await Table.findOne({ name: tname });
  await db.deleteWhere(table.name, { id: id });

  res.redirect(redirect || `/list/${table.name}`);
});
