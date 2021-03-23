const Router = require("express-promise-router");

const Page = require("@saltcorn/data/models/page");
const { div, a, i } = require("@saltcorn/markup/tags");
const { renderForm } = require("@saltcorn/markup");
const { getState } = require("@saltcorn/data/db/state");
const {
  setTenant,
  error_catcher,
  scan_for_page_title,
} = require("../routes/utils.js");
const { add_edit_bar } = require("../markup/admin.js");
const { traverseSync } = require("@saltcorn/data/models/layout");
const { run_action_column } = require("@saltcorn/data/plugin-helper");

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
      const role = req.isAuthenticated() ? req.user.role_id : 10;
      const db_page = await Page.findOne({ name: pagename });
      if (db_page && role <= db_page.min_role) {
        const contents = await db_page.run(req.query, { res, req });
        const title = scan_for_page_title(contents, db_page.title);
        res.sendWrap(
          { title, description: db_page.description } || `${pagename} page`,
          add_edit_bar({
            role,
            title: db_page.name,
            what: req.__("Page"),
            url: `/pageedit/edit/${encodeURIComponent(db_page.name)}`,
            contents,
          })
        );
      } else
        res
          .status(404)
          .sendWrap(`${pagename} page`, req.__("Page %s not found", pagename));
    }
  })
);
router.post(
  "/:pagename/action/:rndid",
  setTenant,
  error_catcher(async (req, res) => {
    const { pagename, rndid } = req.params;
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    const db_page = await Page.findOne({ name: pagename });
    if (db_page && role <= db_page.min_role) {
      let col;
      traverseSync(db_page.layout, {
        action(segment) {
          if (segment.rndid === rndid) col = segment;
        },
      });
      if (col) {
        try {
          const result = await run_action_column({col, req})
          res.json({ success: "ok", ...(result || {}) });
        } catch (e) {
          res.status(400).json({ error: e.message || e });
        }
      } else res.status(404).json({ error: "Action not found" });
    } else res.status(404).json({ error: "Action not found" });
  })
);
