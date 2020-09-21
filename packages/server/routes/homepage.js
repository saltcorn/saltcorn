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

const welcome_page = async (req) => {
  const packs_available = await fetch_available_packs();
  const packlist = [
    ...packs_available.slice(0, 5),
    { name: "More...", description: "" },
  ];
  return {
    above: [
      {
        type: "pageHeader",
        title: "Quick Start",
        blurb: "Four different ways to get started using Saltcorn",
      },
      {
        besides: [
          {
            type: "card",
            title: "Build",
            contents: div(
              p("Start by creating the tables to hold your data"),
              a(
                { href: `/table/new`, class: "btn btn-primary" },
                "Create a table »"
              ),
              p(
                "When you have created the tables, you can create views so users can interact with the data."
              ),
              p("You can also start by creating a page."),
              a(
                { href: `/pageedit/new`, class: "btn btn-primary" },
                "Create a page »"
              )
            ),
          },
          {
            type: "card",
            title: "Upload",
            contents: div(
              p(
                "You can skip creating a table by hand by uploading a CSV file from a spreadsheet."
              ),
              a(
                {
                  href: `/table/create-from-csv`,
                  class: "btn btn-secondary",
                },
                "Create table with CSV upload"
              ),
              p(
                "If you have a backup from a previous Saltcorn instance, you can also restore it."
              ),
              restore_backup(req.csrfToken(), [
                i({ class: "fas fa-upload" }),
                "&nbsp;Restore",
              ])
            ),
          },
        ],
      },
      {
        besides: [
          {
            type: "card",
            title: "Install pack",
            contents: [
              p(
                "Instead of building, get up and running in no time with packs"
              ),
              p(
                { class: "font-italic" },
                "Packs are collections of tables, views and plugins that give you a full application which you can then edit to suit your needs."
              ),
              mkTable(
                [
                  { label: "Name", key: "name" },
                  {
                    label: "Description",
                    key: "description",
                  },
                ],
                packlist,
                { noHeader: true }
              ),
              a(
                { href: `/plugins?set=packs`, class: "btn btn-primary" },
                "Go to pack store »"
              ),
            ],
          },
          {
            type: "card",
            title: "Learn",
            contents: [
              p("Confused?"),
              p(
                "The Wiki contains the documentation and tutorials on installing and using Saltcorn"
              ),
              a(
                {
                  href: `https://wiki.saltcorn.com/`,
                  class: "btn btn-primary",
                },
                "Go to Wiki »"
              ),
              p("The YouTube channel has some video tutorials"),
              a(
                {
                  href: `https://www.youtube.com/channel/UCBOpAcH8ep7ESbuocxcq0KQ`,
                  class: "btn btn-secondary",
                },
                "Go to YouTube »"
              ),
              div(
                { class: "mt-3" },
                a(
                  { href: `https://blog.saltcorn.com/` },
                  "What's new? Read the blog »"
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
    const tables = await Table.find({}, { orderBy: "name" });
    const views = await View.find({});
    if (tables.length === 0) {
      res.sendWrap("Hello", await welcome_page(req));
    } else if (views.length === 0) {
      res.sendWrap("Hello", {
        above: [
          {
            type: "pageHeader",
            title: "Quick Start",
          },
          {
            type: "card",
            title: link("/table", "Tables"),
            contents: div(
              tableTable(tables),
              div(
                a(
                  { href: `/table/new`, class: "btn btn-primary" },
                  "Create a table"
                ),
                a(
                  {
                    href: `/table/create-from-csv`,
                    class: "btn btn-secondary mx-3",
                  },
                  "Create table from CSV upload"
                )
              )
            ),
          },
          {
            type: "card",
            title: link("/viewedit", "Views"),
            contents: [
              div("You have no views!"),
              div(
                a(
                  { href: `/viewedit/new`, class: "btn btn-primary" },
                  "Create a view »"
                )
              ),
            ],
          },
        ],
      });
    } else {
      res.sendWrap("Hello", {
        above: [
          {
            type: "pageHeader",
            title: "Quick Start",
          },
          {
            type: "card",
            title: link("/table", "Tables"),
            contents: div(
              tableTable(tables),
              div(
                a(
                  { href: `/table/new`, class: "btn btn-primary" },
                  "Create a table"
                )
              )
            ),
          },
          {
            type: "card",
            title: link("/viewedit", "Views"),
            contents: [
              viewTable(views),
              div(
                a(
                  { href: `/viewedit/new`, class: "btn btn-primary" },
                  "Create a view"
                )
              ),
            ],
          },
        ],
      });
    }
  }
};

const get_config_response = async (cfgKey, res, req) => {
  const homeCfg = getState().getConfig(cfgKey);
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
  const role = { 10: "public", 8: "user", 4: "staff", 1: "admin" }[role_id];
  const cfgResp = await get_config_response(role + "_home", res, req);
  if (cfgResp) return;

  const views = getState().views.filter(
    (v) => v.on_root_page && (isAuth || v.min_role === 10)
  );

  if (views.length === 0) {
    if (!isAuth) {
      const hasUsers = await User.nonEmpty();
      if (!hasUsers) {
        res.redirect("/auth/create_first_user");
        return;
      } else res.redirect("/auth/login");
    } else {
      await no_views_logged_in(req, res);
    }
  } else if (views.length === 1) {
    const view = views[0];
    const state = view.combine_state_and_default_state(req.query);
    const resp = await view.run(state, { res, req });
    const state_form = await view.get_state_form(state);

    res.sendWrap(
      `${view.name} view`,
      div(state_form ? renderForm(state_form, req.csrfToken()) : "", resp)
    );
  } else {
    const viewlis = views.map((v) => li(link(`/view/${v.name}`, v.name)));
    res.sendWrap(req.__("Hello"), ul(viewlis));
  }
};
