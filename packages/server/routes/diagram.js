const Page = require("@saltcorn/data/models/page");
const {
  buildObjectTrees,
} = require("@saltcorn/data/diagram/node_extract_utils");
const { generateCyCode } = require("@saltcorn/data/diagram/cy_generate_utils");
const { getState } = require("@saltcorn/data/db/state");
const {
  form,
  span,
  input,
  ul,
  label,
  li,
  button,
  div,
  script,
  i,
  domReady,
} = require("@saltcorn/markup/tags");
const { send_infoarch_page } = require("../markup/admin");
const { isAdmin, error_catcher } = require("./utils.js");
const Router = require("express-promise-router");

const router = new Router();
module.exports = router;

const buildEntryPages = async () => {
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
  return pages;
};

const parseBool = (str) => {
  return str === "true";
};

router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const { show_views, show_pages, show_tables, show_trigger, show_all } =
      req.query;
    const pages = await buildEntryPages();
    const extractOpts = {
      entryPages: pages,
      showViews: parseBool(show_all) || parseBool(show_views),
      showPages: parseBool(show_all) || parseBool(show_pages),
      showTables: parseBool(show_all) || parseBool(show_tables),
      showTrigger: parseBool(show_all) || parseBool(show_trigger),
    };
    const cyCode = generateCyCode(await buildObjectTrees(extractOpts));
    const filterFormName = "filterForm";
    const filterSubmit = `document.${filterFormName}.submit()`;
    send_infoarch_page({
      res,
      req,
      active_sub: "Diagram",
      contents: {
        above: [
          {
            type: "card",
            title: req.__(`Application diagram`),
            contents: [
              div(
                { class: "btn-group" },

                // New dropdown
                button(
                  {
                    type: "button",
                    class: "btn btn-primary m-2 rounded",
                    "data-bs-toggle": "dropdown",
                    "aria-expanded": false,
                  },
                  "New",
                  i({ class: "fas fa-plus-square ms-2" })
                ),
                ul(
                  { class: "dropdown-menu" },

                  li(span({ class: "dropdown-item" }, "WIP"))
                ),

                // Filter dropdown
                button(
                  {
                    type: "button",
                    class: "btn btn-primary m-2 rounded",
                    "data-bs-toggle": "dropdown",
                    "aria-expanded": false,
                  },
                  "All entities"
                ),
                form(
                  {
                    action: "/diagram",
                    method: "get",
                    class: "dropdown-menu",
                    name: filterFormName,
                  },
                  input({
                    type: "hidden",
                    name: "_csrf",
                    value: req.csrfToken(),
                  }),
                  // Views checkbox
                  div(
                    { class: "m-3 form-check" },
                    label(
                      { class: "form-check-label", for: "showViewsId" },
                      "Views"
                    ),
                    input({
                      type: "checkbox",
                      class: "form-check-input",
                      id: "showViewsId",
                      checked: extractOpts.showViews,
                      onclick: filterSubmit,
                      name: "show_views",
                      value: "true",
                    })
                  ),
                  // Pages checkbox
                  div(
                    { class: "m-3 form-check" },
                    label(
                      { class: "form-check-label", for: "showPagesId" },
                      "Pages"
                    ),
                    input({
                      type: "checkbox",
                      class: "form-check-input",
                      id: "showPagesId",
                      name: "show_pages",
                      value: "true",
                      checked: extractOpts.showPages,
                      onclick: filterSubmit,
                    })
                  ),
                  // Tables checkbox
                  div(
                    { class: "m-3 form-check" },
                    label(
                      { class: "form-check-label", for: "showTablesId" },
                      "Tables"
                    ),
                    input({
                      type: "checkbox",
                      class: "form-check-input",
                      id: "showTablesId",
                      name: "show_tables",
                      value: "true",
                      checked: extractOpts.showTables,
                      onclick: filterSubmit,
                    })
                  ),
                  // Trigger checkbox
                  div(
                    { class: "m-3 form-check" },
                    label(
                      { class: "form-check-label", for: "showTriggerId" },
                      "Trigger"
                    ),
                    input({
                      type: "checkbox",
                      class: "form-check-input",
                      id: "showTriggerId",
                      name: "show_trigger",
                      value: "true",
                      checked: extractOpts.showTrigger,
                      onclick: filterSubmit,
                    })
                  )
                ),

                // Tags dropdown
                button(
                  {
                    type: "button",
                    class: "btn btn-primary m-2 rounded",
                    "data-bs-toggle": "dropdown",
                    "aria-expanded": false,
                  },
                  "Tags"
                ),
                ul(
                  { class: "dropdown-menu" },
                  li(span({ class: "dropdown-item" }, "WIP"))
                )
              ),

              div({ id: "cy" }),
              script(domReady(cyCode)),
            ],
          },
        ],
      },
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
    });
  })
);
