const State = require("saltcorn-data/db/state");
const db = require("saltcorn-data/db");
const View = require("saltcorn-data/models/view");
const { link, renderForm, mkTable, post_btn } = require("saltcorn-markup");
const { ul, li, div, small, a, h5 } = require("saltcorn-markup/tags");
const Table = require("saltcorn-data/models/table");
const { fetch_available_packs } = require("saltcorn-data/models/pack");

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
  const role = req.isAuthenticated() ? req.user.role_id : 4;
  if (role > 1) res.sendWrap("Hello", "Welcome to saltcorn!");
  else {
    const tables = await Table.find({}, { orderBy: "name" });
    const views = await View.find({});
    if (tables.length === 0) {
      const packs_available = await fetch_available_packs();
      const packs_installed = State.getConfig("installed_packs", []);

      res.sendWrap("Hello", {
        pageHeader: "Quick Start",
        above: [
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
              div("Or install a pack:"),
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
        pageHeader: "Quick Start",
        above: [
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
        pageHeader: "Quick Start",
        above: [
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

module.exports = async (req, res) => {
  const isAuth = req.isAuthenticated();
  const views = State.views.filter(
    v => v.on_root_page && (isAuth || v.is_public)
  );

  if (views.length === 0) {
    if (!isAuth) {
      res.redirect("/auth/login");
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
