/**
 * @category server
 * @module routes/page
 * @subcategory routes
 */

const Router = require("express-promise-router");
const { UAParser } = require("ua-parser-js");

const Page = require("@saltcorn/data/models/page");
const PageGroup = require("@saltcorn/data/models/page_group");
const Trigger = require("@saltcorn/data/models/trigger");
const { getState, features } = require("@saltcorn/data/db/state");
const {
  error_catcher,
  scan_for_page_title,
  isAdmin,
  sendHtmlFile,
} = require("../routes/utils.js");
const { isTest } = require("@saltcorn/data/utils");
const { add_edit_bar } = require("../markup/admin.js");
const { script, domReady } = require("@saltcorn/markup/tags");
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
  if (role <= page.min_role) {
    const contents = await page.run(req.query, { res, req });
    const title = scan_for_page_title(contents, page.title);
    const tock = new Date();
    const ms = tock.getTime() - tic.getTime();
    if (!isTest())
      Trigger.emitEvent("PageLoad", null, req.user, {
        text: req.__("Page '%s' was loaded", page.name),
        type: "page",
        name: page.name,
        render_time: ms,
      });
    if (contents.html_file) await sendHtmlFile(req, res, contents.html_file);
    else
      res.sendWrap(
        {
          title,
          description: page.description,
          bodyClass: "page_" + db.sqlsanitize(page.name),
          no_menu: page.attributes?.no_menu,
        } || `${page.name} page`,
        add_edit_bar({
          role,
          title: page.name,
          what: req.__("Page"),
          url: `/pageedit/edit/${encodeURIComponent(page.name)}`,
          contents,
        })
      );
  } else {
    getState().log(2, `Page ${page.name} not authorized`);
    res.status(404).sendWrap(` page`, req.__("Page %s not found", page.name));
  }
};

const screenInfoFromCfg = (req) => {
  const uaScreenInfos = getState().getConfig("user_agent_screen_infos", {});
  const uaParser = new UAParser(req.headers["user-agent"]);
  const device = uaParser.getDevice();
  if (!device.type) return uaScreenInfos.web;
  else return uaScreenInfos[device.type];
};

const runPageGroup = async (pageGroup, req, res, tic) => {
  const role = req.user && req.user.id ? req.user.role_id : 100;
  if (role <= pageGroup.min_role) {
    if (pageGroup.members.length === 0) {
      getState().log(2, `Pagegroup ${pageGroup.name} has no members`);
      res
        .status(400)
        .sendWrap(
          ` page`,
          req.__("Pagegroup %s has no members", pageGroup.name)
        );
    } else {
      let screenInfos = null;
      if (req.cookies["_sc_screen_info_"])
        screenInfos = JSON.parse(req.cookies["_sc_screen_info_"]);
      else {
        const strategy = getState().getConfig(
          "missing_screen_info_strategy",
          "guess_from_user_agent"
        );
        if (strategy === "guess_from_user_agent")
          screenInfos = screenInfoFromCfg(req);
        else if (strategy === "reload" && req.query.is_reload !== "true") {
          return res.sendWrap(
            script(
              domReady(`
                setScreenInfoCookie();
                window.location = updateQueryStringParameter(window.location.href, "is_reload", true);`)
            )
          );
        }
      }
      const eligiblePage = await pageGroup.getEligiblePage(
        screenInfos,
        req.user ? req.user : { role_id: features.public_user_role },
        req.getLocale()
      );
      if (eligiblePage) await runPage(eligiblePage, req, res, tic);
      else {
        getState().log(2, `Pagegroup ${pageGroup.name} has no eligible page`);
        res
          .status(404)
          .sendWrap(` page`, req.__("%s has no eligible page", pageGroup.name));
      }
    }
  } else {
    getState().log(2, `Pagegroup ${pageGroup.name} not authorized`);
    res
      .status(404)
      .sendWrap(` page`, req.__("Pagegroup %s not found", pageGroup.name));
  }
};

router.get(
  "/:pagename",
  error_catcher(async (req, res) => {
    const { pagename } = req.params;
    getState().log(3, `Route /page/${pagename} user=${req.user?.id}`);
    const tic = new Date();
    const { page, pageGroup } = findPageOrGroup(pagename);
    if (page) await runPage(page, req, res, tic);
    else if (pageGroup) await runPageGroup(pageGroup, req, res, tic);
    else {
      if ((page || pageGroup) && !req.user) {
        res.redirect(`/auth/login?dest=${encodeURIComponent(req.originalUrl)}`);
      } else {
        getState().log(2, `Page ${pagename} not found or not authorized`);
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
