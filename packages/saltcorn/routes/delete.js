const Router = require("express-promise-router");

const db = require("../db");
const { loggedIn } = require("./utils.js");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.post("/:tname/:id", loggedIn, async (req, res) => {
  const { tname, id } = req.params;
  const { redirect } = req.query;
  const table = await db.get_table_by_name(tname);
  await db.deleteWhere(table.name, { id: id });

  res.redirect(redirect || `/list/${table.name}`);
});
