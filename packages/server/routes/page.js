const Router = require("express-promise-router");

const View = require("@saltcorn/data/models/view");
const { div } = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const { setTenant } = require("../routes/utils.js");

const router = new Router();
module.exports = router;

router.get("/:pagename", setTenant, async (req, res) => {
  const { pagename } = req.params;
  const page = getState().pages[pagename];
  if (page) {
    const contents = await page.getPage();
    res.sendWrap({title: page.title, description: page.description} || `${pagename} page`, contents);
  } else {
    res.status(404).sendWrap(`${pagename} page`, `Page ${pagename} not found`);
  }
});
