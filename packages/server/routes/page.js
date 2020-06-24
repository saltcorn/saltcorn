const Router = require("express-promise-router");

const Page = require("@saltcorn/data/models/page");
const { div } = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const { setTenant, error_catcher } = require("../routes/utils.js");

const router = new Router();
module.exports = router;

router.get(
  "/:pagename",
  setTenant,
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    const page = getState().pages[pagename];
    if (page) {
      const contents = await page.getPage();
      res.sendWrap(
        { title: page.title, description: page.description } ||
          `${pagename} page`,
        contents
      );
    } else {
      const db_page = await Page.findOne({ name: pagename });
      if (db_page) {
        res.sendWrap(
          { title: db_page.title, description: db_page.description } ||
            `${pagename} page`,
          db_page.layout
        );
      } else
        res
          .status(404)
          .sendWrap(`${pagename} page`, `Page ${pagename} not found`);
    }
  })
);
