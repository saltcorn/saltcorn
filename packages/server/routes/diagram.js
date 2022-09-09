const Page = require("@saltcorn/data/models/page");
const {
  buildObjectTrees,
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
    const modernCfg = getState().getConfig("home_page_by_role");
    let pages = null;
    if (modernCfg) {
      pages = Object.values(modernCfg)
        .filter((val) => val)
        .map((val) => Page.findOne({ name: val }));
    } else {
      pages = new Array();
      for (const legacyRole of ["public", "user", "staff", "admin"]) {
        const page = await Page.findOne({ name: `${legacyRole}_home` });
        if (page) pages.push(page);
      }
    }
    const cyCode = generateCyCode(await buildObjectTrees(pages));
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
