const Router = require("express-promise-router");

const db = require("../db");
const { mkTable, mkForm, wrap, h, link, post_btn } = require("./markup.js");
const { sqlsanitize } = require("./utils.js");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.post("/:tname/:id", async (req, res) => {
  const { tname, id } = req.params;
  const table = await db.get_table_by_name(tname);
  await db.deleteWhere(table.name, {id: id});

  res.redirect(`/list/${table.name}`);
});
