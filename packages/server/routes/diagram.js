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
const Tag = require("@saltcorn/data/models/tag");
const Router = require("express-promise-router");

const router = new Router();
module.exports = router;

function reloadCy() {
  $.ajax("/diagram/data", {
    dataType: "json",
    type: "GET",
    headers: { "CSRF-Token": _sc_globalCsrf },
    data: !tagFilterEnabled ? entityFilter : { ...entityFilter, tagFilterIds },
  }).done((res) => {
    const cfg = {
      container: document.getElementById("cy"),
      ...res,
    };
    window.cy = cytoscape(cfg);
  });
}

function toggleEntityFilter(type) {
  switch (type) {
    case "views": {
      entityFilter.showViews = !entityFilter.showViews;
      break;
    }
    case "pages": {
      entityFilter.showPages = !entityFilter.showPages;
      break;
    }
    case "tables": {
      entityFilter.showTables = !entityFilter.showTables;
      break;
    }
    case "trigger": {
      entityFilter.showTrigger = !entityFilter.showTrigger;
      break;
    }
  }
}

function toggleTagFilter(id) {
  if (!tagFilterEnabled) enableTagFilter();
  const index = tagFilterIds.indexOf(id);
  if (index > -1) {
    tagFilterIds.splice(index, 1);
  } else {
    tagFilterIds.push(id);
  }
}

function enableTagFilter() {
  tagFilterEnabled = true;
  for (const node of document.querySelectorAll('[id^="tagFilter_box_"]')) {
    node.style = "";
  }
  for (const node of document.querySelectorAll('[id^="tagFilter_label_"]')) {
    node.style = "";
  }
  const box = document.getElementById("noTagsId");
  box.checked = false;
}

function toggleTagFilterMode() {
  if (tagFilterEnabled) {
    tagFilterEnabled = false;
    for (const node of document.querySelectorAll('[id^="tagFilter_box_"]')) {
      node.style = "opacity: 0.5;";
    }
    for (const node of document.querySelectorAll('[id^="tagFilter_label_"]')) {
      node.style = "opacity: 0.5;";
    }
  } else {
    enableTagFilter();
  }
}

const buildScript = () => {
  return `const entityFilter = {
    showViews: true,
    showPages: true,
    showTables: true,
    showTrigger: true,
  };  
  const tagFilterIds = [];
  let tagFilterEnabled = false;
  ${reloadCy.toString()}
  ${toggleTagFilterMode.toString()}
  ${enableTagFilter.toString()}
  ${toggleEntityFilter.toString()}
  ${toggleTagFilter.toString()}`;
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
                  input({
                    type: "hidden",
                    name: "_csrf",
                    value: req.csrfToken(),
                  }),
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
                  })
                )
              ),
              div({ id: "cy" }),
              script(domReady(initialCyCode)),
              script(buildScript()),
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
