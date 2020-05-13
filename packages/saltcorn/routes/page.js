const Router = require("express-promise-router");

const View = require("saltcorn-data/models/view");
const { div } = require("saltcorn-markup/tags");
const { renderForm } = require("saltcorn-markup");
const State = require("saltcorn-data/db/state");

const router = new Router();
module.exports = router;

router.get("/:pagename", async (req, res) => {
  const { pagename } = req.params;
  const page = State.pages[pagename];
  res.sendWrap(`${pagename} page`, page);
});
