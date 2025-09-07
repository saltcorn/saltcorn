/**
 * @category server
 * @module routes/page
 * @subcategory routes
 */

const Router = require("express-promise-router");

const Page = require("@saltcorn/data/models/page");
const PageGroup = require("@saltcorn/data/models/page_group");
const Trigger = require("@saltcorn/data/models/trigger");
const { getState } = require("@saltcorn/data/db/state");
const {
  error_catcher,
  scan_for_page_title,
  isAdmin,
  sendHtmlFile,
  getEligiblePage,
  getRandomPage,
} = require("../routes/utils.js");
const { isTest } = require("@saltcorn/data/utils");
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

const findPageOrGroup = (pagename) => {
  const page = Page.findOne({ name: pagename });
  if (page) return { page, pageGroup: null };
  else {
    const pageGroup = PageGroup.findOne({ name: pagename });
    if (pageGroup) return { page: null, pageGroup };
    else return { page: null, pageGroup: null };
  }
};

const runPage = async (page, req, res, tic) => {
  const role = req.user && req.user.id ? req.user.role_id : 100;
  // let resultCollector = {};
  if (role <= page.min_role) {
    const contents = await page.run(req.query, { res, req });
    const title = scan_for_page_title(contents, page.title);
    const tock = new Date();
    const ms = tock.getTime() - tic.getTime();

    if (!isTest()) {
      Trigger.emitEvent("PageLoad", null, req.user, {
        text: req.__("Page '%s' was loaded", page.name),
        type: "page",
        name: page.name,
        render_time: ms,
      });
    }
    if (contents.html_file) await sendHtmlFile(req, res, contents.html_file);
    else
      res.sendWrap(
        {
          title,
          description: page.description,
          bodyClass: "page_" + db.sqlsanitize(page.name),
          no_menu: page.attributes?.no_menu,
          requestFluidLayout: page.attributes?.request_fluid_layout,
        } || `${page.name} page`,
        req.smr
          ? contents
          : add_edit_bar({
              role,
              title: page.name,
              what: req.__("Page"),
              url: `/pageedit/edit/${encodeURIComponent(page.name)}?on_done_redirect=${encodeURIComponent(req.originalUrl.replace("/", ""))}`,
              contents,
            })
      );
  } else {
    getState().log(2, `Page ${page.name} not authorized`);
    if (!req.user) {
      res.redirect(`/auth/login?dest=${encodeURIComponent(req.originalUrl)}`);
      return;
    }
    res
      .status(404)
      .sendWrap(
        req.__("Page not found"),
        req.__("Page %s not found", page.name)
      );
  }
};

const runPageGroup = async (pageGroup, req, res, tic) => {
  const role = req.user && req.user.id ? req.user.role_id : 100;
  if (role <= pageGroup.min_role) {
    if (pageGroup.random_allocation) {
      const page = getRandomPage(pageGroup, req);
      if (typeof page === "string") {
        getState().log(2, page);
        res.status(400).sendWrap(req.__("Internal Error"), page);
      } else if (!page) {
        getState().log(2, `Unable to find a random page in ${pageGroup.name}`);
        res
          .status(404)
          .sendWrap(
            req.__("Internal Error"),
            req.__("Unable to find a random page in %s", pageGroup.name)
          );
      } else await runPage(page, req, res, tic);
    } else {
      const eligible = await getEligiblePage(pageGroup, req, res);
      if (typeof eligible === "string") {
        getState().log(2, eligible);
        res.status(400).sendWrap(req.__("Internal Error"), eligible);
      } else if (eligible) {
        if (!eligible.isReload) await runPage(eligible, req, res, tic);
      } else {
        getState().log(2, `Pagegroup ${pageGroup.name} has no eligible page`);
        res
          .status(404)
          .sendWrap(
            req.__("Internal Error"),
            req.__("%s has no eligible page", pageGroup.name)
          );
      }
    }
  } else {
    getState().log(2, `Pagegroup ${pageGroup.name} not authorized`);
    if (!req.user) {
      res.redirect(`/auth/login?dest=${encodeURIComponent(req.originalUrl)}`);
      return;
    }
    res
      .status(404)
      .sendWrap(
        req.__("Internal Error"),
        req.__("Pagegroup %s not found", pageGroup.name)
      );
  }
};

router.get(
  "/:pagename",
  error_catcher(async (req, res) => {
    const state = getState();
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );
    const maintenanceModePage = state.getConfig("maintenance_mode_page", "");

    if (
      maintenanceModeEnabled &&
      (!req.user || req.user.role_id > 1) &&
      maintenanceModePage
    ) {
      const maintenancePage = await Page.findOne({ name: maintenanceModePage });
      if (maintenancePage) {
        await runPage(maintenancePage, req, res, new Date());
        return;
      }
    }

    const { pagename } = req.params;
    state.log(
      3,
      `Route /page/${pagename} user=${req.user?.id}${
        state.getConfig("log_ip_address", false) ? ` IP=${req.ip}` : ""
      }`
    );
    const tic = new Date();
    const { page, pageGroup } = findPageOrGroup(pagename);
    if (page) await runPage(page, req, res, tic);
    else if (pageGroup) await runPageGroup(pageGroup, req, res, tic);
    else {
      if ((page || pageGroup) && !req.user) {
        res.redirect(`/auth/login?dest=${encodeURIComponent(req.originalUrl)}`);
      } else {
        state.log(2, `Page ${pagename} not found or not authorized`);
        res
          .status(404)
          .sendWrap(
            req.__("Internal Error"),
            req.__("Page %s not found", pagename)
          );
      }
    }
  })
);

router.post(
  "/:pagename/preview",
  isAdmin,
  error_catcher(async (req, res) => {
    const state = getState();
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );
    if (maintenanceModeEnabled && (!req.user || req.user.role_id > 1)) {
      res.status(503).json({ error: "in maintenance mode" });
      return;
    }

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

router.post(
  "/:pagename/action/:rndid",
  error_catcher(async (req, res) => {
    const state = getState();
    const maintenanceModeEnabled = state.getConfig(
      "maintenance_mode_enabled",
      false
    );
    if (maintenanceModeEnabled && (!req.user || req.user.role_id > 1)) {
      res.status(503).json({ error: "in maintenance mode" });
      return;
    }

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
          const result = await db.withTransaction(async () => {
            return await run_action_column({
              col,
              referrer: req.get("Referrer"),
              req,
              res,
            });
          });
          res.json({ success: "ok", ...(result || {}) });
        } catch (e) {
          getState().log(2, e?.stack);
          res.status(400).json({ error: e.message || e });
        }
      } else res.status(404).json({ error: "Action not found" });
    } else res.status(404).json({ error: "Action not found" });
  })
);
