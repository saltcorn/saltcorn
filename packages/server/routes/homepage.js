const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
const Page = require("@saltcorn/data/models/page");
const { link, renderForm, mkTable, post_btn } = require("@saltcorn/markup");
const { ul, li, div, small, a, h5, p, i } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { fetch_available_packs } = require("@saltcorn/data/models/pack");
const { restore_backup } = require("../markup/admin");
const { get_latest_npm_version } = require("@saltcorn/data/models/config");
const packagejson = require("../package.json");

const tableTable = (tables) =>
  mkTable(
    [
      { label: "Name", key: "name" },
      { label: "Edit", key: (r) => link(`/table/${r.id}`, "Edit") },
    ],
    tables
  );

const viewTable = (views) =>
  mkTable(
    [
      { label: "Name", key: "name" },
      {
        label: "Run",
        key: (r) => link(`/view/${encodeURIComponent(r.name)}`, "Run"),
      },
      {
        label: "Edit",
        key: (r) =>
          link(`/viewedit/edit/${encodeURIComponent(r.name)}`, "Edit"),
      },
    ],
    views
  );

const pageTable = (pages) =>
  mkTable(
    [
      { label: "Name", key: "name" },
      {
        label: "Run",
        key: (r) => link(`/page/${encodeURIComponent(r.name)}`, "Run"),
      },
      {
        label: "Edit",
        key: (r) =>
          link(`/pageedit/edit/${encodeURIComponent(r.name)}`, "Edit"),
      },
    ],
    pages
  );

const welcome_page = async (req) => {
  const packs_available = await fetch_available_packs();
  const packlist = [
    ...packs_available.slice(0, 5),
    { name: req.__("More..."), description: "" },
  ];
  return {
    above: [
      {
        type: "pageHeader",
        title: req.__("Quick Start"),
        blurb: req.__("Four different ways to get started using Saltcorn"),
      },
      {
        besides: [
          {
            type: "card",
            title: req.__("Build"),
            contents: div(
              p(req.__("Start by creating the tables to hold your data")),
              a(
                { href: `/table/new`, class: "btn btn-primary" },
                req.__("Create a table »")
              ),
              p(
                req.__(
                  "When you have created the tables, you can create views so users can interact with the data."
                )
              ),
              p(req.__("You can also start by creating a page.")),
              a(
                { href: `/pageedit/new`, class: "btn btn-primary" },
                req.__("Create a page »")
              )
            ),
          },
          {
            type: "card",
            title: req.__("Upload"),
            contents: div(
              p(
                req.__(
                  "You can skip creating a table by hand by uploading a CSV file from a spreadsheet."
                )
              ),
              a(
                {
                  href: `/table/create-from-csv`,
                  class: "btn btn-secondary",
                },
                req.__("Create table with CSV upload")
              ),
              p(
                req.__(
                  "If you have a backup from a previous Saltcorn instance, you can also restore it."
                )
              ),
              restore_backup(req.csrfToken(), [
                i({ class: "fas fa-upload" }),
                "&nbsp;",
                req.__("Restore"),
              ])
            ),
          },
        ],
      },
      {
        besides: [
          {
            type: "card",
            title: req.__("Install pack"),
            contents: [
              p(
                req.__(
                  "Instead of building, get up and running in no time with packs"
                )
              ),
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
              ),
            ],
          },
          {
            type: "card",
            title: req.__("Learn"),
            contents: [
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
              ),
            ],
          },
        ],
      },
    ],
  };
};

const no_views_logged_in = async (req, res) => {
  const role = req.isAuthenticated() ? req.user.role_id : 10;
  if (role > 1 || req.user.tenant !== db.getTenantSchema())
    res.sendWrap(req.__("Hello"), req.__("Welcome to Saltcorn!"));
  else {
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;
    const latest = isRoot && (await get_latest_npm_version("@saltcorn/cli"));
    const can_update = packagejson.version !== latest;
    if (latest && can_update)
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
    const tables = await Table.find({}, { orderBy: "name" });
    const views = await View.find({});
    const pages = await Page.find({});
    if (tables.length <= 1) {
      //users
      res.sendWrap(req.__("Hello"), await welcome_page(req));
    } else if (views.length === 0) {
      res.sendWrap("Hello", {
        above: [
          {
            type: "pageHeader",
            title: req.__("Quick Start"),
          },
          {
            type: "card",
            title: link("/table", req.__("Tables")),
            contents: div(
              tableTable(tables),
              div(
                a(
                  { href: `/table/new`, class: "btn btn-primary" },
                  req.__("Create a table")
                ),
                a(
                  {
                    href: `/table/create-from-csv`,
                    class: "btn btn-secondary mx-3",
                  },
                  req.__("Create table from CSV upload")
                )
              )
            ),
          },
          {
            type: "card",
            title: link("/viewedit", req.__("Views")),
            contents: [
              div(req.__("You have no views!")),
              div(
                a(
                  { href: `/viewedit/new`, class: "btn btn-primary" },
                  req.__("Create a view »")
                )
              ),
            ],
          },
        ],
      });
    } else {
      res.sendWrap(req.__("Hello"), {
        above: [
          {
            type: "pageHeader",
            title: req.__("Quick Start"),
          },
          {
            type: "card",
            title: link("/table", req.__("Tables")),
            contents: div(
              tableTable(tables),
              div(
                a(
                  { href: `/table/new`, class: "btn btn-primary" },
                  req.__("Create a table")
                )
              )
            ),
          },
          {
            type: "card",
            title: link("/viewedit", req.__("Views")),
            contents: [
              viewTable(views),
              div(
                a(
                  { href: `/viewedit/new`, class: "btn btn-primary" },
                  req.__("Create a view")
                )
              ),
            ],
          },
          {
            type: "card",
            title: link("/pageedit", req.__("Pages")),
            contents: [
              pageTable(pages),
              div(
                a(
                  { href: `/pageedit/new`, class: "btn btn-primary" },
                  req.__("Create a page")
                )
              ),
            ],
          },
        ],
      });
    }
  }
};

const get_config_response = async (role_id, res, req) => {
  const modernCfg = getState().getConfig("home_page_by_role", false);
  const legacy_role = { 10: "public", 8: "user", 4: "staff", 1: "admin" }[
    role_id
  ];
  let homeCfg = modernCfg && modernCfg[role_id];
  if (typeof homeCfg !== "string")
    homeCfg = getState().getConfig(legacy_role + "_home");
  if (homeCfg) {
    if (getState().pages[homeCfg]) {
      const page = getState().pages[homeCfg];
      const contents = await page.getPage();
      res.sendWrap(
        page.title
          ? { title: page.title, description: page.description }
          : homeCfg,
        contents
      );
      return true;
    } else {
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
  }
};
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
