import Page from "@saltcorn/data/models/page";
import { buildObjectTrees } from "@saltcorn/data/diagram/node_extract_utils";
import {
  generateCyCode,
  genereateCyCfg,
} from "@saltcorn/data/diagram/cy_generate_utils";
import { getState } from "@saltcorn/data/db/state";
import {
  a,
  input,
  label,
  button,
  div,
  script,
  i,
  domReady,
} from "@saltcorn/markup/tags";
import { send_infoarch_page } from "../markup/admin.js";
import { isAdmin, error_catcher } from "./utils.js";
import Tag from "@saltcorn/data/models/tag";
import Router from "express-promise-router";
import User from "@saltcorn/data/models/user";
import db from "@saltcorn/data/db";
import { Req, Res } from "@saltcorn/types/base_types";

const router = Router();
export default router;

const buildGlobalVars = (tags: any, roles: any) => {
  return `
    const allTags = ${JSON.stringify(tags)};
    const roles = ${JSON.stringify(roles)};
  `;
};

const findEntryPages = async () => {
  const modernCfg = getState()!.getConfig("home_page_by_role");
  let pages;
  if (modernCfg) {
    pages = Object.values(modernCfg)
      .filter((val: any) => val)
      .map((val: any) => Page.findOne({ name: val }));
  } else {
    pages = [];
    for (const legacyRole of ["public", "user", "staff", "admin"]) {
      const page = (await Page.findOne({ name: `${legacyRole}_home` }))!;
      if (page) pages.push(page);
    }
  }
  return pages;
};

const buildFilterIds = async (tags: any) => {
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

const parseBool = (str: any) => {
  return str === "true";
};

router.get(
  "/",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const extractOpts = {
      entryPages: await findEntryPages(),
      showViews: true,
      showPages: true,
      showTables: true,
      showTrigger: true,
    };
    const initialCyCode = generateCyCode(await buildObjectTrees(extractOpts));
    const tags = (await Tag.find())!;
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
                { class: "d-flex justify-content-between" },
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
                    req.__("All entities")
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
                        req.__("Views")
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
                        req.__("Pages")
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
                        req.__("Tables")
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
                        req.__("Triggers")
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
                    req.__("Tags")
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
                        req.__("no tags")
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
                    tags.map((tag: any) => {
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
                // screenshot button
                div(
                  { class: "ad-screenshot-panel" },
                  button(
                    {
                      type: "button",
                      class: "btn btn-primary m-2 rounded",
                      onclick: "takePicture()",
                    },
                    i({ class: "fas fa-camera" })
                  )
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
          script: `/static_assets/${db.connectObj.version_tag}/popper.min.js`,
        },
        {
          script: `/static_assets/${db.connectObj.version_tag}/cytoscape.min.js`,
        },
        {
          script: `/static_assets/${db.connectObj.version_tag}/cytoscape-popper.min.js`,
        },
      ],
    });
  })
);

router.get(
  "/data",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const { showViews, showPages, showTables, showTrigger } = req.query;
    const tagFilterIds = req.query.tagFilterIds
      ? req.query.tagFilterIds.map((id: any) => parseInt(id))
      : [];
    const tags = (await Tag.find()).filter(
      (tag: any) => tagFilterIds.indexOf(tag.id) > -1
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
