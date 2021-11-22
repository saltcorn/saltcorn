/**
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
const { link, renderForm, mkTable, post_btn } = require("@saltcorn/markup");
const { ul, li, div, small, a, h5, p, i } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { fetch_available_packs } = require("@saltcorn/data/models/pack");
const { restore_backup } = require("../markup/admin");
const { get_latest_npm_version } = require("@saltcorn/data/models/config");
const packagejson = require("../package.json");
const Trigger = require("@saltcorn/data/models/trigger");
const { fileUploadForm } = require("../markup/forms");

/**
 * @param {*} tables
 * @param {object} req
 * @returns {Table}
 */
const tableTable = (tables, req) =>
  mkTable(
    [
      { label: req.__("Name"), key: "name" },
      {
        label: req.__("Edit"),
        key: (r) => link(`/table/${r.id}`, req.__("Edit")),
      },
    ],
    tables
  );

/**
 * @param {*} tables
 * @param {object} req
 * @returns {object}
 */
const tableCard = (tables, req) => ({
  type: "card",
  class: "welcome-page-entity-list",
  title: link("/table", req.__("Tables")),
  contents:
    (tables.length <= 1
      ? p(
          { class: "mt-2 pr-2" },
          i(req.__("Tables organise data by fields and rows."))
        )
      : "") + tableTable(tables, req),
  bodyClass: "py-0 pr-0",
  footer: div(
    a({ href: `/table/new`, class: "btn btn-primary" }, req.__("Create table")),
    a(
      {
        href: `/table/create-from-csv`,
        class: "btn btn-secondary ml-2",
      },
      req.__("CSV upload")
    )
  ),
});

/**
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
          link(`/viewedit/edit/${encodeURIComponent(r.name)}`, req.__("Edit")),
      },
    ],
    views
  );

/**
 * @param {*} views
 * @param {object} req
 * @returns {object}
 */
const viewCard = (views, req) => ({
  type: "card",
  title: link("/viewedit", req.__("Views")),
  class: "welcome-page-entity-list",
  bodyClass: "py-0  pr-0",
  contents:
    (views.length <= 1
      ? p(
          { class: "mt-2 pr-2" },
          i(
            req.__(
              "Views display data from tables. A view is a view template applied to a table, with configuration."
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
 * @param {*} pages
 * @param {object} req
 * @returns {object}
 */
const pageCard = (pages, req) => ({
  type: "card",
  title: link("/pageedit", req.__("Pages")),
  class: "welcome-page-entity-list",
  contents:
    (pages.length <= 1
      ? p(
          { class: "mt-2 pr-2" },
          i(
            req.__(
              "Pages are the web pages of your application built with a drag-and-drop builder. They have static content, and by embedding views, dynamic content."
            )
          )
        )
      : "") +
    (pages.length > 0
      ? pageTable(pages, req)
      : div({ class: "mt-2 pr-2" }, p(req.__("No pages")))),
  bodyClass: "py-0 pr-0",
  footer: div(
    a(
      { href: `/pageedit/new`, class: "btn btn-primary" },
      req.__("Create page")
    )
  ),
});

/**
 * @param {object} req
 * @returns {Promise<div>}
 */
const filesTab = async (req) => {
  const files = await File.find({}, { orderBy: "filename", cached: true });
  return div(
    files.length == 0
      ? p(req.__("No files"))
      : mkTable(
          [
            {
              label: req.__("Filename"),
              key: (r) => link(`/files/serve/${r.id}`, r.filename),
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
 * @param {object} req
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
 * @param {object} req
 * @returns {Promise<div>}
 */
const actionsTab = async (req, triggers) => {
  return div(
    { class: "pb-3" },
    triggers.length <= 1 &&
      p(
        { class: "mt-2 pr-2" },
        i(req.__("Triggers run actions in response to events."))
      ),
    triggers.length == 0
      ? p(req.__("No triggers"))
      : mkTable(
          [
            { label: req.__("Name"), key: "name" },
            { label: req.__("Action"), key: "action" },
            {
              label: req.__("Table or Channel"),
              key: (r) => r.table_name || r.channel,
            },
            {
              label: req.__("When"),
              key: (a) =>
                a.when_trigger === "API call"
                  ? `API: ${base_url}api/action/${a.name}`
                  : a.when_trigger,
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
const packTab = (req, packlist) =>
  div(
    { class: "pb-3 pt-2 pr-4" },
    p(req.__("Instead of building, get up and running in no time with packs")),
    p(
      { class: "font-italic" },
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
      { href: `/plugins?set=packs`, class: "btn btn-primary" },
      req.__("Go to pack store »")
    )
  );

const helpCard = (req) =>
  div(
    { class: "pb-3 pt-2 pr-4" },
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
 * @param {object} req
 * @returns {Promise<object>}
 */
const welcome_page = async (req) => {
  const packs_available = await fetch_available_packs();
  const packlist = [
    ...packs_available.slice(0, 5),
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
          pageCard(pages, req),
          viewCard(views, req),
          tableCard(tables, req),
        ],
      },
      {
        besides: [
          {
            type: "card",
            //title: req.__("Install pack"),
            bodyClass: "py-0 pr-0",
            class: "welcome-page-entity-list",

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
            bodyClass: "py-0 pr-0",
            class: "welcome-page-entity-list",
            tabContents:
              users.length > 4
                ? {
                    Users: await usersTab(req, users, roleMap),
                    Help: helpCard(req),
                  }
                : {
                    Help: helpCard(req),
                    Users: await usersTab(req, users, roleMap),
                  },
          },
        ],
      },
    ],
  };
};

/**
 * @param {object} req
 * @param {object} res
 * @returns {Promise<void>}
 */
const no_views_logged_in = async (req, res) => {
  const role = req.isAuthenticated() ? req.user.role_id : 10;
  if (role > 1 || req.user.tenant !== db.getTenantSchema())
    res.sendWrap(req.__("Hello"), req.__("Welcome to Saltcorn!"));
  else {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    const latest = isRoot && (await get_latest_npm_version("@saltcorn/cli"));
    const can_update =
      packagejson.version !== latest && !process.env.SALTCORN_DISABLE_UPGRADE;
    if (latest && can_update && isRoot)
      req.flash(
        "warning",
        req.__(
          "An upgrade to Saltcorn is available! Current version: %s; latest version: %s.",
          packagejson.version,
          latest
        ) +
          " " +
          a({ href: "/admin/system" }, req.__("Upgrade here"))
      );

    res.sendWrap(req.__("Hello"), await welcome_page(req));
  }
};

/**
 * @param {number} role_id
 * @param {object} res
 * @param {object} req
 * @returns {Promise<boolean>}
 */
const get_config_response = async (role_id, res, req) => {
  const modernCfg = getState().getConfig("home_page_by_role", false);
  const legacy_role = { 10: "public", 8: "user", 4: "staff", 1: "admin" }[
    role_id
  ];
  let homeCfg = modernCfg && modernCfg[role_id];
  if (typeof homeCfg !== "string")
    homeCfg = getState().getConfig(legacy_role + "_home");
  if (homeCfg) {
    const db_page = await Page.findOne({ name: homeCfg });

    if (db_page) {
      const contents = await db_page.run(req.query, { res, req });

      res.sendWrap(
        { title: db_page.title, description: db_page.description } ||
          `${pagename} page`,
        contents
      );
    } else res.redirect(homeCfg);
    return true;
  }
};

/**
 * Function assigned to 'module.exports'.
 * @param {object} req
 * @param {object} res
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  const isAuth = req.isAuthenticated();
  const role_id = req.user ? req.user.role_id : 10;
  const cfgResp = await get_config_response(role_id, res, req);
  if (cfgResp) return;

  if (!isAuth) {
    const hasUsers = await User.nonEmpty();
    if (!hasUsers) {
      res.redirect("/auth/create_first_user");
      return;
    } else res.redirect("/auth/login");
  } else {
    await no_views_logged_in(req, res);
  }
};
