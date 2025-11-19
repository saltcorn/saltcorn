/**
 * Default Home Page (Wellcome page)
 * Opens for new site without any data
 * @category server
 * @module routes/homepage
 * @subcategory routes
 */

const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
const File = require("@saltcorn/data/models/file");
const Page = require("@saltcorn/data/models/page");
const PageGroup = require("@saltcorn/data/models/page_group");
const Plugin = require("@saltcorn/data/models/plugin");
const { link, mkTable } = require("@saltcorn/markup");
const { div, a, p, i, h5, span, title } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { get_cached_packs } = require("@saltcorn/admin-models/models/pack");
// const { restore_backup } = require("../markup/admin");
const {
  get_latest_npm_version,
  get_saltcorn_npm_versions,
} = require("@saltcorn/data/models/config");
const packagejson = require("../package.json");
const Trigger = require("@saltcorn/data/models/trigger");
const { fileUploadForm } = require("../markup/forms");
const { get_base_url, sendHtmlFile, getEligiblePage } = require("./utils.js");
const semver = require("semver");
const { add_results_to_contents } = require("../markup/admin.js");

/**
 * Tables List
 * @param {*} tables
 * @param {object} req
 * @returns {Table}
 */
const tableTable = (tables, req) =>
  mkTable(
    [
      {
        label: req.__("Name"),
        key: (r) => link(`/table/${r.id}`, r.name),
      },
    ],
    tables
  );

/**
 * Tables Card
 * @param {*} tables
 * @param {object} req
 * @returns {object}
 */
const tableCard = (tables, req) => ({
  type: "card",
  class: "welcome-page-entity-list mt-1",
  title: link("/table", req.__("Tables")),
  contents:
    (tables.length <= 1
      ? p(
          { class: "mt-2 pe-2" },
          i(req.__("Tables organise data by fields and rows."))
        )
      : "") + tableTable(tables, req),
  bodyClass: "py-0 pe-0",
  footer: div(
    { class: "text-nowrap", style: { overflowX: "hidden" } },
    a({ href: `/table/new`, class: "btn btn-primary" }, req.__("Create table")),
    a(
      {
        href: `/table/create-from-csv`,
        class: "btn btn-secondary ms-2",
      },
      req.__("CSV upload")
    )
  ),
});

/**
 * Views List
 * @param {*} views
 * @param {object} req
 * @returns {Table}
 */
const viewTable = (views, req) =>
  mkTable(
    [
      {
        label: req.__("Name"),
        key: (r) => link(`/view/${encodeURIComponent(r.name)}`, r.name),
      },
      {
        label: req.__("Edit"),
        key: (r) =>
          r.singleton
            ? ""
            : link(
                `/viewedit/edit/${encodeURIComponent(r.name)}`,
                req.__("Edit")
              ),
      },
    ],
    views
  );

/**
 * Views Card
 * @param {*} views
 * @param {object} req
 * @returns {object}
 */
const viewCard = (views, req) => ({
  type: "card",
  title: link("/viewedit", req.__("Views")),
  class: "welcome-page-entity-list mt-1",
  bodyClass: "py-0  pe-0",
  contents:
    (views.length <= 1
      ? p(
          { class: "mt-2 pe-2" },
          i(
            req.__(
              "Views display data from tables. A view is a view pattern applied to a table, with configuration."
            )
          )
        )
      : "") +
    (views.length > 0 ? viewTable(views, req) : p(req.__("No views"))),

  footer: div(
    a(
      { href: `/viewedit/new`, class: "btn btn-primary" },
      req.__("Create view")
    )
  ),
});

/**
 * Pages List
 * @param {*} pages
 * @param {object} req
 * @returns {Table}
 */
const pageTable = (pages, req) =>
  mkTable(
    [
      {
        label: req.__("Name"),
        key: (r) => link(`/page/${encodeURIComponent(r.name)}`, r.name),
      },
      {
        label: req.__("Edit"),
        key: (r) =>
          link(`/pageedit/edit/${encodeURIComponent(r.name)}`, req.__("Edit")),
      },
    ],
    pages
  );

/**
 * Page Card
 * @param {*} pages
 * @param {object} req
 * @returns {object}
 */
const pageCard = (pages, req) => ({
  type: "card",
  title: link("/pageedit", req.__("Pages")),
  class: "welcome-page-entity-list mt-1",
  contents:
    (pages.length <= 1
      ? p(
          { class: "mt-2 pe-2" },
          i(
            req.__(
              "Pages are the web pages of your application built with a drag-and-drop builder. They have static content, and by embedding views, dynamic content."
            )
          )
        )
      : "") +
    (pages.length > 0
      ? pageTable(pages, req)
      : div({ class: "mt-2 pe-2" }, p(req.__("No pages")))),
  bodyClass: "py-0 pe-0",
  footer: div(
    a(
      { href: `/pageedit/new`, class: "btn btn-primary" },
      req.__("Create page")
    )
  ),
});

/**
 * Files Tab
 * @param {object} req
 * @returns {Promise<div>}
 */
const filesTab = async (req) => {
  const files = await File.find({}, { orderBy: "filename", cached: true });
  return div(
    files.length === 0
      ? p(req.__("No files"))
      : mkTable(
          [
            {
              label: req.__("Filename"),
              key: (r) =>
                r.isDirectory
                  ? r.filename
                  : link(`/files/serve/${r.path_to_serve}`, r.filename),
            },
            { label: req.__("Size (KiB)"), key: "size_kb", align: "right" },
            { label: req.__("Media type"), key: (r) => r.mimetype },
          ],
          files
        ),
    fileUploadForm(req)
  );
};

/**
 * Users Tab
 * @param {object} req
 * @param users
 * @param roleMap
 * @returns {Promise<div>}
 */
const usersTab = async (req, users, roleMap) => {
  return div(
    mkTable(
      [
        {
          label: req.__("Email"),
          key: (r) => link(`/useradmin/${r.id}`, r.email),
        },

        { label: req.__("Role"), key: (r) => roleMap[r.role_id] },
      ],
      users
    ),
    a(
      { href: `/useradmin/new`, class: "btn btn-secondary my-3" },
      req.__("Create user")
    )
  );
};

/**
 * Actions (Triggers) Tab
 * @param {object} req
 * @param triggers
 * @returns {Promise<div>}
 */
const actionsTab = async (req, triggers) => {
  const base_url = get_base_url(req);

  return div(
    { class: "pb-3" },
    triggers.length <= 1 &&
      p(
        { class: "mt-2 pe-2" },
        i(req.__("Triggers run actions in response to events."))
      ),
    triggers.length === 0
      ? p(req.__("No triggers"))
      : mkTable(
          [
            {
              label: req.__("Name"),
              key: (tr) => a({ href: `actions/configure/${tr.id}` }, tr.name),
            },
            { label: req.__("Action"), key: "action" },
            {
              label: req.__("Table or Channel"),
              key: (r) => r.table_name || r.channel,
            },
            {
              label: req.__("When"),
              key: (act) =>
                act.when_trigger +
                (act.when_trigger === "API call"
                  ? a(
                      {
                        href: `javascript:ajax_modal('/admin/help/API%20actions?name=${act.name}')`,
                      },
                      i({ class: "fas fa-question-circle ms-1" })
                    )
                  : ""),
            },
          ],
          triggers
        ),
    a(
      { href: "/actions/new", class: "btn btn-secondary my-3" },
      req.__("Add trigger")
    )
  );
};
/**
 * Plugins and Packs Tab
 * @param req
 * @param packlist
 * @returns {*}
 */
const packTab = (req, packlist) =>
  div(
    { class: "pb-3 pt-2 pe-4" },
    p(req.__("Instead of building, get up and running in no time with packs")),
    p(
      { class: "fst-italic" },
      req.__(
        "Packs are collections of tables, views and plugins that give you a full application which you can then edit to suit your needs."
      )
    ),
    mkTable(
      [
        { label: req.__("Name"), key: "name" },
        {
          label: req.__("Description"),
          key: "description",
        },
      ],
      packlist,
      { noHeader: true }
    ),
    a(
      { href: `/plugins?set=packs`, class: "btn btn-sm btn-primary" },
      req.__("Go to pack store »")
    )
  );

const themeCard = (req, roleMap) => {
  const state_layouts = getState().layouts;
  const state_layout_names = Object.keys(state_layouts);
  const layout_by_role = getState().getConfig("layout_by_role");
  const used_layout_by_role = {};
  Object.keys(roleMap).forEach((role_id) => {
    used_layout_by_role[role_id] =
      layout_by_role[role_id] ||
      state_layout_names[state_layout_names.length - 1];
  });
  const themes_available = Plugin.get_cached_plugins().filter(
    (p) => p.has_theme && !state_layout_names.includes(p.name)
  );
  const layouts = Object.entries(getState().layouts)
    .filter(([nm, v]) => nm !== "emergency")
    .map(([name, layout]) => {
      let plugin = getState().plugins[name];
      const for_role = Object.entries(used_layout_by_role)
        .filter(([role, rname]) => rname === name)
        .map(([role, rname]) =>
          span({ class: "badge bg-info" }, roleMap[role])
        );

      return {
        name,
        layout,
        plugin,
        for_role,
        edit_cfg_link: plugin?.configuration_workflow
          ? a(
              {
                href: `/plugins/configure/${encodeURIComponent(name)}`,
              },
              i({ class: "fa fa-cog ms-2" })
            )
          : "",
      };
    });
  const show_installable = themes_available.length > 0 || layouts.length == 1;
  return div(
    { class: "pb-3 pt-2 pe-4" },
    mkTable(
      [
        {
          label: req.__("Installed theme"),
          key: ({ name, edit_cfg_link }) => `${name}${edit_cfg_link}`,
        },
        {
          label: req.__("Theme for role"),
          key: ({ for_role }) => for_role.join(" "),
        },
      ],
      layouts
    ),
    a({ href: "/roleadmin" }, req.__("Set theme for each user role »")),
    show_installable && h5({ class: "mt-2" }, req.__("Available themes")),
    show_installable &&
      div(
        themes_available
          .map((p) => span({ class: "badge bg-secondary" }, p.name))
          .join(" ")
      ),
    show_installable &&
      a(
        { href: `/plugins?set=themes`, class: "mt-2" },
        req.__("Install more themes »")
      )
  );
};
/**
 * Help Card
 * @param req
 * @returns {*}
 */
const helpCard = (req) =>
  div(
    { class: "pb-3 pt-2 pe-4" },
    p(req.__("Confused?")),
    p(
      req.__(
        "The Wiki contains the documentation and tutorials on installing and using Saltcorn"
      )
    ),
    a(
      {
        href: `https://wiki.saltcorn.com/`,
        class: "btn btn-primary",
      },
      req.__("Go to Wiki »")
    ),
    p(req.__("The YouTube channel has some video tutorials")),
    a(
      {
        href: `https://www.youtube.com/channel/UCBOpAcH8ep7ESbuocxcq0KQ`,
        class: "btn btn-secondary",
      },
      req.__("Go to YouTube »")
    ),
    div(
      { class: "mt-3" },
      a(
        { href: `https://blog.saltcorn.com/` },
        req.__("What's new? Read the blog »")
      )
    )
  );

/**
 * Wellcome page
 * @param {object} req
 * @returns {Promise<object>}
 */
const welcome_page = async (req) => {
  const packs_available = await get_cached_packs();
  const packlist = [
    ...(packs_available || []).slice(0, 5),
    { name: req.__("More..."), description: "" },
  ];
  const tables = await Table.find({}, { cached: true });
  const views = await View.find({}, { cached: true });
  const pages = await Page.find({}, { cached: true });
  const triggers = await Trigger.findAllWithTableName();
  const users = await User.find({}, { orderBy: "id" });
  const roles = await User.get_roles();
  let roleMap = {};
  roles.forEach((r) => {
    roleMap[r.id] = r.role;
  });
  return {
    above: [
      {
        besides: [
          tableCard(tables, req),
          viewCard(views, req),
          pageCard(pages, req),
        ],
        class: "welcome-page-row1",
      },
      {
        class: "welcome-page-row2",
        besides: [
          {
            type: "card",
            //title: req.__("Install pack"),
            bodyClass: "py-0 pe-0",
            class: "welcome-page-entity-list mt-2",

            tabContents:
              triggers.length > 0
                ? {
                    Triggers: await actionsTab(req, triggers),
                    Files: await filesTab(req),
                    Packs: packTab(req, packlist),
                  }
                : {
                    Packs: packTab(req, packlist),
                    Triggers: await actionsTab(req, triggers),
                    Files: await filesTab(req),
                  },
          },
          {
            type: "card",
            //title: req.__("Learn"),
            bodyClass: "py-0 pe-0",
            class: "welcome-page-entity-list mt-2",
            tabContents:
              users.length > 4
                ? {
                    Users: await usersTab(req, users, roleMap),
                    Theme: themeCard(req, roleMap),
                    Help: helpCard(req),
                  }
                : {
                    Help: helpCard(req),
                    Theme: themeCard(req, roleMap),
                    Users: await usersTab(req, users, roleMap),
                  },
          },
        ],
      },
    ],
  };
};

/**
 * No Views logged in
 * @param {object} req
 * @param {object} res
 * @returns {Promise<void>}
 */
const no_views_logged_in = async (req, res) => {
  const role = req.user && req.user.id ? req.user.role_id : 100;
  if (role > 1 || req.user.tenant !== db.getTenantSchema())
    res.sendWrap(req.__("Hello"), req.__("Welcome to Saltcorn!"));
  else {
    const airgap = getState().getConfig("airgap", false);
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    const versions =
      isRoot && !airgap && (await get_saltcorn_npm_versions(500));
    const eligible_upgrades =
      isRoot &&
      !airgap &&
      versions?.filter?.(
        (v) =>
          semver.gt(v, packagejson.version) &&
          (packagejson.version.includes("-") || !v?.includes("-"))
      );

    const can_update =
      eligible_upgrades?.length && !process.env.SALTCORN_DISABLE_UPGRADE;
    if (can_update && isRoot)
      req.flash(
        "warning",
        req.__(
          "An upgrade to Saltcorn is available! Current version: %s; latest version: %s.",
          packagejson.version,
          eligible_upgrades[eligible_upgrades.length - 1]
        ) +
          " " +
          a({ href: "/admin/system" }, req.__("Upgrade here"))
      );

    res.sendWrap(req.__("Hello"), await welcome_page(req));
  }
};

/**
 * Get Config respounce
 * @param {number} role_id
 * @param {object} res
 * @param {object} req
 * @returns {Promise<boolean>}
 */
const get_config_response = async (role_id, res, req) => {
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
    const db_page = await Page.findOne({ name: maintenanceModePage });
    if (db_page) {
      res.sendWrap(
        {
          title: db_page.title,
          description: db_page.description,
          bodyClass: "page_" + db.sqlsanitize(maintenanceModePage),
        },
        await db_page.run(req.query, { res, req })
      );
      return true;
    } else {
      res.status(503).send("Page Unavailable: in maintenance mode");
      return true;
    }
  }

  const wrap = async (
    contents,
    homeCfg,
    title,
    description,
    no_menu,
    requestFluidLayout
  ) => {
    const resultCollector = {};

    await Trigger.runTableTriggers(
      "PageLoad",
      null,
      {
        text: "Homepage loaded",
        type: "home",
        query: req.query,
      },
      resultCollector,
      req.user,
      { req }
    );

    if (contents.html_file) await sendHtmlFile(req, res, contents.html_file);
    else
      res.sendWrap(
        {
          title: title || "",
          description: description || "",
          bodyClass: "page_" + db.sqlsanitize(homeCfg),
          no_menu,
          requestFluidLayout,
        },
        add_results_to_contents(contents, resultCollector)
      );
  };
  const modernCfg = getState().getConfig("home_page_by_role", false);
  // predefined roles
  const legacy_role = { 100: "public", 80: "user", 40: "staff", 1: "admin" }[
    role_id
  ];
  let homeCfg = modernCfg && modernCfg[role_id];
  if (typeof homeCfg !== "string")
    homeCfg = getState().getConfig(legacy_role + "_home");
  if (homeCfg) {
    const db_page = Page.findOne({ name: homeCfg });
    if (db_page)
      wrap(
        await db_page.run(req.query, { res, req }),
        homeCfg,
        db_page.title,
        db_page.description,
        db_page.attributes?.no_menu,
        db_page.attributes?.request_fluid_layout
      );
    else {
      const group = PageGroup.findOne({ name: homeCfg });
      if (group) {
        const eligible = await getEligiblePage(group, req, res);
        if (typeof eligible === "string") wrap(eligible);
        else if (eligible) {
          if (!eligible.isReload)
            wrap(
              await eligible.run(req.query, { res, req }),
              homeCfg,
              eligible.title,
              eligible.description,
              eligible.attributes?.no_menu,
              eligible.attributes?.request_fluid_layout
            );
        } else wrap(req.__("%s has no eligible page", group.name), homeCfg);
      } else res.redirect(homeCfg);
    }
    return true;
  }
};

module.exports =
  /**
   * Function assigned to 'module.exports'.
   * @param {object} req
   * @param {object} res
   * @returns {Promise<void>}
   */
  async (req, res) => {
    const isAuth = req.user && req.user.id;
    const role_id = req.user ? req.user.role_id : 100;
    const cfgResp = await get_config_response(role_id, res, req);
    if (cfgResp) return;

    if (!isAuth) {
      const hasUsers = await User.nonEmpty();
      if (!hasUsers) {
        res.redirect("/auth/create_first_user");
        // return;
      } else res.redirect("/auth/login");
    } else {
      await no_views_logged_in(req, res);
    }
  };
