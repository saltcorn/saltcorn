const Page = require("@saltcorn/data/models/page");
const {
  buildObjectTrees,
} = require("@saltcorn/data/diagram/node_extract_utils");
const {
  generateCyCode,
  genereateCyCfg,
} = require("@saltcorn/data/diagram/cy_generate_utils");
const { getState } = require("@saltcorn/data/db/state");
const {
  a,
  input,
  label,
  button,
  div,
  script,
  i,
  domReady,
} = require("@saltcorn/markup/tags");
const { send_infoarch_page } = require("../markup/admin");
const { isAdmin, error_catcher } = require("./utils.js");
const Tag = require("@saltcorn/data/models/tag");
const Router = require("express-promise-router");
const User = require("@saltcorn/data/models/user");

const router = new Router();
module.exports = router;

const buildGlobalVars = (tags, roles) => {
  return `
    const allTags = ${JSON.stringify(tags)};
    const roles = ${JSON.stringify(roles)};
  `;
};

const findEntryPages = async () => {
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

const buildFilterIds = async (tags) => {
  if (!tags || tags.length === 0) return null;
  else {
    const viewFilterIds = new Set();
    const pageFilterIds = new Set();
    const tableFilterIds = new Set();
    const triggerFilterIds = new Set();
    for (const tag of tags) {
      for (const id of await tag.getViewIds()) viewFilterIds.add(id);
      for (const id of await tag.getPageIds()) pageFilterIds.add(id);
      for (const id of await tag.getTableIds()) tableFilterIds.add(id);
      for (const id of await tag.getTriggerIds()) triggerFilterIds.add(id);
    }
    return {
      viewFilterIds,
      pageFilterIds,
      tableFilterIds,
      triggerFilterIds,
    };
  }
};

const parseBool = (str) => {
  return str === "true";
};

router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const extractOpts = {
      entryPages: await findEntryPages(),
      showViews: true,
      showPages: true,
      showTables: true,
      showTrigger: true,
    };
    const initialCyCode = generateCyCode(await buildObjectTrees(extractOpts));
    const tags = await Tag.find();
    const roles = await User.get_roles();
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

                div(
                  {
                    class: "dropdown-menu",
                  },
                  // New View
                  div(
                    { class: "m-3" },

                    a(
                      {
                        href: "/viewedit/new?on_done_redirect=diagram",
                      },
                      req.__("View")
                    )
                  ),
                  // New Page
                  div(
                    { class: "m-3" },
                    a(
                      {
                        href: "/pageedit/new?on_done_redirect=diagram",
                      },
                      req.__("Page")
                    )
                  ),
                  // New Table
                  div(
                    { class: "m-3" },
                    a(
                      {
                        href: "/table/new",
                      },
                      req.__("Table")
                    )
                  ),
                  // New Trigger
                  div(
                    { class: "m-3" },
                    a(
                      {
                        href: "/actions/new?on_done_redirect=diagram",
                      },
                      req.__("Trigger")
                    )
                  )
                ),
                // Entity type filter dropdown
                button(
                  {
                    type: "button",
                    class: "btn btn-primary m-2 rounded",
                    "data-bs-toggle": "dropdown",
                    "aria-expanded": false,
                  },
                  "All entities"
                ),
                div(
                  {
                    class: "dropdown-menu",
                  },
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
                      checked: true,
                      name: "show_views",
                      value: "true",
                      onclick: "toggleEntityFilter('views'); reloadCy();",
                      autocomplete: "off",
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
                      checked: true,
                      onclick: "toggleEntityFilter('pages'); reloadCy();",
                      autocomplete: "off",
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
                      checked: true,
                      onclick: "toggleEntityFilter('tables'); reloadCy();",
                      autocomplete: "off",
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
                      checked: true,
                      onclick: "toggleEntityFilter('trigger'); reloadCy();",
                      autocomplete: "off",
                    })
                  )
                ),
                // Tags filter dropdown
                button(
                  {
                    type: "button",
                    class: "btn btn-primary m-2 rounded",
                    "data-bs-toggle": "dropdown",
                    "aria-expanded": false,
                  },
                  "Tags"
                ),
                div(
                  {
                    class: "dropdown-menu",
                  },
                  // no tags checkbox
                  div(
                    { class: "m-3 form-check" },
                    label(
                      { class: "form-check-label", for: "noTagsId" },
                      "no tags"
                    ),
                    input({
                      type: "checkbox",
                      class: "form-check-input",
                      id: "noTagsId",
                      name: "no_tags",
                      value: "true",
                      checked: true,
                      onclick: "toggleTagFilterMode(); reloadCy();",
                      autocomplete: "off",
                    })
                  ),
                  tags.map((tag) => {
                    const inputId = `tagFilter_box_${tag.name}_id`;
                    return div(
                      { class: "m-3 form-check" },
                      label(
                        {
                          class: "form-check-label",
                          id: `tagFilter_label_${tag.name}`,
                          style: "opacity: 0.5;",
                          for: inputId,
                        },
                        tag.name
                      ),
                      input({
                        type: "checkbox",
                        class: "form-check-input",
                        id: inputId,
                        name: "choice",
                        value: tag.id,
                        checked: false,
                        onclick: `toggleTagFilter(${tag.id});  reloadCy();`,
                        autocomplete: "off",
                      })
                    );
                  }),
                  div(
                    { class: "m-3" },
                    a(
                      {
                        href: "/tag/new",
                      },
                      req.__("Add tag"),
                      i({ class: "fas fa-plus ms-2" })
                    )
                  )
                ),
                // refresh button
                button(
                  {
                    type: "button",
                    class: "btn btn-primary m-2 rounded",
                    onclick: "reloadCy(true);",
                  },
                  i({ class: "fas fa-sync-alt" })
                )
              ),
              div({ id: "cy" }),
              script(buildGlobalVars(tags, roles)),
              script({ src: "/diagram_utils.js" }),
              script(domReady(initialCyCode)),
            ],
          },
        ],
      },
      headers: [
        {
          style: `
            #cy {
              width: 100%;
              height: 900px;
              display: block;
            }`,
        },
        {
          script:
            "https://cdnjs.cloudflare.com/ajax/libs/popper.js/2.9.2/umd/popper.min.js",
        },
        {
          script:
            "https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.22.1/cytoscape.min.js",
        },
        {
          script:
            "https://cdnjs.cloudflare.com/ajax/libs/cytoscape-popper/2.0.0/cytoscape-popper.min.js",
        },
      ],
    });
  })
);

router.get(
  "/data",
  isAdmin,
  error_catcher(async (req, res) => {
    const { showViews, showPages, showTables, showTrigger } = req.query;
    const tagFilterIds = req.query.tagFilterIds
      ? req.query.tagFilterIds.map((id) => parseInt(id))
      : [];
    const tags = (await Tag.find()).filter(
      (tag) => tagFilterIds.indexOf(tag.id) > -1
    );
    let extractOpts = {
      entryPages: await findEntryPages(),
      showViews: parseBool(showViews),
      showPages: parseBool(showPages),
      showTables: parseBool(showTables),
      showTrigger: parseBool(showTrigger),
    };
    const filterIds = await buildFilterIds(tags);
    if (filterIds) {
      extractOpts = { ...extractOpts, ...filterIds };
    }
    res.json(genereateCyCfg(await buildObjectTrees(extractOpts)));
  })
);
