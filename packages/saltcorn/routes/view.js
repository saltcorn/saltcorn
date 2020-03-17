const Router = require("express-promise-router");

const db = require("../db");
const viewtemplates = require("../viewtemplates");
const { wrap } = require("../markup");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.get("/:viewname", async (req, res) => {
  const { viewname } = req.params;

  const viewrow = await db.selectOne("views", { name: viewname });
  const view = viewtemplates[viewrow.viewtemplate];
  const resp = await view.run(
    viewrow.table_id,
    viewrow.configuration,
    req.query
  );
  res.sendWrap(`${viewrow.name} view`, resp);
});
