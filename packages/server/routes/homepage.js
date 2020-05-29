const { getState } = require("@saltcorn/data/db/state");
const db = require("@saltcorn/data/db");
const View = require("@saltcorn/data/models/view");
const User = require("@saltcorn/data/models/user");
const { link, renderForm, mkTable, post_btn } = require("@saltcorn/markup");
const { ul, li, div, small, a, h5 } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { fetch_available_packs } = require("@saltcorn/data/models/pack");

const tableTable = tables =>
  mkTable(
    [
      { label: "Name", key: "name" },
      { label: "Edit", key: r => link(`/table/${r.id}`, "Edit") }
    ],
    tables
  );

const viewTable = views =>
  mkTable(
    [
      { label: "Name", key: "name" },
      {
        label: "Edit",
        key: r => link(`viewedit/edit/${encodeURIComponent(r.name)}`, "Edit")
      }
    ],
    views
  );

const no_views_logged_in = async (req, res) => {
  const role = req.isAuthenticated() ? req.user.role_id : 10;
  if (role > 1 || req.user.tenant !== db.getTenantSchema())
    res.sendWrap("Hello", "Welcome to saltcorn!");
  else {
    const tables = await Table.find({}, { orderBy: "name" });
    const views = await View.find({});
    if (tables.length === 0) {
      const packs_available = await fetch_available_packs();
      const packs_installed = getState().getConfig("installed_packs", []);

      res.sendWrap("Hello", {
        above: [
          {
            type: "pageHeader",
            title: "Quick Start"
          },
          {
            type: "card",
            title: "Tables",
            contents: div(
              div("You have no tables and no views!"),
              div(link("/table/new", "Create a table »"))
            )
          },
          {
            type: "card",
            title: "Packs",
            contents: [
              div(
                "Packs are collections of tables, views and plugins that give you a full application which you can then edit to suit your needs."
              ),
              mkTable(
                [
                  { label: "Name", key: "name" },
                  {
                    label: "Install",
                    key: r =>
                      packs_installed.includes(r.name)
                        ? "Installed"
                        : post_btn(
                            `/packs/install-named/${encodeURIComponent(
                              r.name
                            )}`,
                            "Install"
                          )
                  }
                ],
                packs_available
              )
            ]
          }
        ]
      });
    } else if (views.length === 0) {
      res.sendWrap("Hello", {
        above: [
          {
            type: "pageHeader",
            title: "Quick Start"
          },
          {
            type: "card",
            title: "Tables",
            contents: div(
              tableTable(tables),
              div(link("/table/new", "Create a table »"))
            )
          },
          {
            type: "card",
            title: "Views",
            contents: [
              div("You have no views!"),
              div(link("/viewedit/new", "Create a view »"))
            ]
          }
        ]
      });
    } else {
      res.sendWrap("Hello", {
        above: [
          {
            type: "pageHeader",
            title: "Quick Start"
          },
          {
            type: "card",
            title: "Tables",
            contents: div(
              tableTable(tables),
              div(link("/table/new", "Create a table »"))
            )
          },
          {
            type: "card",
            title: "Views",
            contents: [
              viewTable(views),
              div(link("/viewedit/new", "Create a view »"))
            ]
          }
        ]
      });
    }
  }
};
const get_config_response = async (cfgKey, res) => {
  const homeCfg = getState().getConfig(cfgKey);
  if (homeCfg) {
    if (homeCfg.startsWith("/page/")) {
      const thePage = homeCfg.slice(6);
      const page = getState().pages[thePage];
      if (page) {
        const contents = await page.getPage();
        res.sendWrap(page.title || thePage, contents);
        return true;
      }
    } else {
      res.redirect(homeCfg);
      return true;
    }
  }
};
module.exports = async (req, res) => {
  const isAuth = req.isAuthenticated();
  if (!isAuth) {
    const cfgResp = await get_config_response("public_home", res);
    if (cfgResp) return;
  } else if (isAuth && req.user.role_id === 8) {
    const cfgResp = await get_config_response("user_home", res);
    if (cfgResp) return;
  }
  const views = getState().views.filter(
    v => v.on_root_page && (isAuth || v.is_public)
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

    const resp = await view.run(req.query);
    const state_form = await view.get_state_form(req.query);

    res.sendWrap(
      `${view.name} view`,
      div(state_form ? renderForm(state_form) : "", resp)
    );
  } else {
    const viewlis = views.map(v => li(link(`/view/${v.name}`, v.name)));
    res.sendWrap("Hello", ul(viewlis));
  }
};
