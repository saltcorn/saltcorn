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
  if (page) {
    const contents = await page.getPage();
    res.sendWrap(page.title || `${pagename} page`, contents);
  } else {
    res.status(404).sendWrap(`${pagename} page`, `Page ${pagename} not found`);
  }
});
