/**
 * @category server
 * @module routes/page
 * @subcategory routes
 */

const Router = require("express-promise-router");

const Page = require("@saltcorn/data/models/page");
const Trigger = require("@saltcorn/data/models/trigger");
const { getState } = require("@saltcorn/data/db/state");
const {
  error_catcher,
  scan_for_page_title,
  isAdmin,
} = require("../routes/utils.js");
const { add_edit_bar } = require("../markup/admin.js");
const { traverseSync } = require("@saltcorn/data/models/layout");
const { run_action_column } = require("@saltcorn/data/plugin-helper");
const db = require("@saltcorn/data/db");

/**
 * @type {object}
 * @const
 * @namespace pageRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name get/:pagename
 * @function
 * @memberof module:routes/page~pageRouter
 * @function
 */
router.get(
  "/:pagename",
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    const state = getState();
    state.log(3, `Route /page/${pagename} user=${req.user?.id}`);
    const tic = new Date();

    const role = req.user && req.user.id ? req.user.role_id : 100;
    const db_page = await Page.findOne({ name: pagename });
    if (db_page && role <= db_page.min_role) {
      const contents = await db_page.run(req.query, { res, req });
      const title = scan_for_page_title(contents, db_page.title);
      const tock = new Date();
      const ms = tock.getTime() - tic.getTime();
      Trigger.emitEvent("PageLoad", null, req.user, {
        text: req.__("Page '%s' was loaded", pagename),
        type: "page",
        name: pagename,
        render_time: ms,
      });
      res.sendWrap(
        {
          title,
          description: db_page.description,
          bodyClass: "page_" + db.sqlsanitize(pagename),
        } || `${pagename} page`,
        add_edit_bar({
          role,
          title: db_page.name,
          what: req.__("Page"),
          url: `/pageedit/edit/${encodeURIComponent(db_page.name)}`,
          contents,
        })
      );
    } else {
      if (db_page && !req.user) {
        res.redirect(`/auth/login?dest=${encodeURIComponent(req.originalUrl)}`);
      } else {
        state.log(2, `Page $pagename} not found or not authorized`);
        res
          .status(404)
          .sendWrap(`${pagename} page`, req.__("Page %s not found", pagename));
      }
    }
  })
);

router.post(
  "/:pagename/preview",
  isAdmin,
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    const page = await Page.findOne({ name: pagename });
    if (!page) {
      res.send("");
      return;
    }
    const contents = await page.run(req.query, { res, req });
    res.sendWrap({}, contents);
  })
);

/**
 * @name post/:pagename/action/:rndid
 * @function
 * @memberof module:routes/page~pageRouter
 * @function
 */
router.post(
  "/:pagename/action/:rndid",
  error_catcher(async (req, res) => {
    const { pagename, rndid } = req.params;
    const role = req.user && req.user.id ? req.user.role_id : 100;
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
          const result = await run_action_column({
            col,
            referrer: req.get("Referrer"),
            req,
            res,
          });
          res.json({ success: "ok", ...(result || {}) });
        } catch (e) {
          res.status(400).json({ error: e.message || e });
        }
      } else res.status(404).json({ error: "Action not found" });
    } else res.status(404).json({ error: "Action not found" });
  })
);
