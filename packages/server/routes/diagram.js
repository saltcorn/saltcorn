const Page = require("@saltcorn/data/models/page");
const {
  buildObjectTree,
} = require("@saltcorn/data/diagram/node_extract_utils");
const { generateCyCode } = require("@saltcorn/data/diagram/cy_generate_utils");
const { getState } = require("@saltcorn/data/db/state");
const { div, script, domReady } = require("@saltcorn/markup/tags");
const { isAdmin, error_catcher } = require("./utils.js");
const Router = require("express-promise-router");

const router = new Router();
module.exports = router;

router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const role_id = req.user.role_id ? req.user.role_id : 10;
    const modernCfg = getState().getConfig("home_page_by_role");
    const legacy_role = { 10: "public", 8: "user", 4: "staff", 1: "admin" }[
      role_id
    ];
    let homeCfg = modernCfg && modernCfg[role_id];
    if (typeof homeCfg !== "string") {
      homeCfg = getState().getConfig(legacy_role + "_home");
    }
    const entryPage = Page.findOne({
      name: homeCfg,
    });
    if (!entryPage) {
      req.flash(
        "error",
        req.__("Unable to create a diagram, no entry page was found.")
      );
      return res.redirect("/admin/system");
    }
    const cyCode = generateCyCode(buildObjectTree(entryPage));
    res.sendWrap(
      {
        title: req.__(`Application diagram`),
        headers: [
          {
            script:
              "https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.22.1/cytoscape.min.js",
            style: `
            #cy {
              width: 100%;
              height: 900px;
              display: block;
          }`,
          },
        ],
      },
      {
        above: [
          {
            type: "card",
            title: req.__(`Application diagram`),
            contents: [div({ id: "cy" }), script(domReady(cyCode))],
          },
        ],
      }
    );
  })
);
