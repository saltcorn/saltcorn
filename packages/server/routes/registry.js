const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const { mkTable, link, post_btn, renderForm } = require("@saltcorn/markup");
const {
  script,
  domReady,
  a,
  div,
  h4,
  i,
  text,
  button,
  input,
  label,
  form,
  ul,
  li,
  details,
  summary,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { isAdmin, error_catcher } = require("./utils");
const { send_infoarch_page } = require("../markup/admin.js");
const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");
const Form = require("@saltcorn/data/models/form");
const {
  table_pack,
  view_pack,
  plugin_pack,
  page_pack,
  page_group_pack,
  role_pack,
  library_pack,
  trigger_pack,
  tag_pack,
  model_pack,
  model_instance_pack,
  event_log_pack,
  install_pack,
} = require("@saltcorn/admin-models/models/pack");
const Trigger = require("@saltcorn/data/models/trigger");
const { getState } = require("@saltcorn/data/db/state");
/**
 * @type {object}
 * @const
 * @namespace listRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

async function asyncFilter(arr, cb) {
  const filtered = [];

  for (const element of arr) {
    const needAdd = await cb(element);

    if (needAdd) {
      filtered.push(element);
    }
  }

  return filtered;
}
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const { etype, ename, q } = req.query;
    const qlink = q ? `&q=${encodeURIComponent(q)}` : "";
    let edContents = "Choose an entity to edit";
    const all_tables = await Table.find({}, { orderBy: "name", nocase: true });
    const all_views = await View.find({}, { orderBy: "name", nocase: true });
    const all_pages = await Page.find({}, { orderBy: "name", nocase: true });
    const all_triggers = await Trigger.find(
      {},
      { orderBy: "name", nocase: true }
    );
    const isRoot = db.getTenantSchema() === db.connectObj.default_schema;

    const all_configs_obj = await getState().getAllConfigOrDefaults();
    const all_configs = Object.entries(all_configs_obj)
      .map(([name, v]) => ({
        ...v,
        name,
      }))
      .filter((c) => isRoot || !c.root_only);

    let tables, views, pages, triggers, configs;
    if (q) {
      const qlower = q.toLowerCase();
      const includesQ = (s) => s.toLowerCase().includes(qlower);

      tables = await asyncFilter(all_tables, async (t) => {
        const pack = await table_pack(t);
        return includesQ(JSON.stringify(pack));
      });
      views = await asyncFilter(all_views, async (t) => {
        const pack = await view_pack(t);
        return includesQ(JSON.stringify(pack));
      });
      pages = await asyncFilter(all_pages, async (t) => {
        const pack = await page_pack(t);
        return includesQ(JSON.stringify(pack));
      });
      triggers = await asyncFilter(all_triggers, async (t) => {
        const pack = await trigger_pack(t);
        return includesQ(JSON.stringify(pack));
      });
      configs = all_configs.filter((c) => includesQ(JSON.stringify(c)));
    } else {
      tables = all_tables;
      views = all_views;
      pages = all_pages;
      triggers = all_triggers;
      configs = all_configs;
    }
    const li_link = (etype1, ename1) =>
      li(
        a(
          {
            href: `/registry-editor?etype=${etype1}&ename=${encodeURIComponent(
              ename1
            )}${qlink}`,
            class: etype1 === etype && ename1 === ename ? "fw-bold" : undefined,
          },
          ename1
        )
      );
    const mkForm = (jsonVal) =>
      new Form({
        labelCols: 0,
        action: `/registry-editor?etype=${etype}&ename=${encodeURIComponent(
          ename
        )}${qlink}`,
        formStyle: "vert",
        values: { regval: JSON.stringify(jsonVal, null, 2) },
        fields: [
          {
            name: "regval",
            label: "",
            input_type: "code",
            class: "enlarge-in-card",
            attributes: { mode: "application/json" },
          },
        ],
      });
    let cfg_link = "";
    switch (etype) {
      case "table":
        const tpack = await table_pack(
          all_tables.find((t) => t.name === ename)
        );
        cfg_link = a(
          { href: `/table/${encodeURIComponent(ename)}` },
          `${ename} ${etype}`
        );
        edContents = renderForm(mkForm(tpack), req.csrfToken());
        break;
      case "view":
        cfg_link =
          `${ename} ${etype}` +
          a(
            {
              class: "ms-2",
              href: `/viewedit/edit/${encodeURIComponent(ename)}`,
            },
            "Edit&nbsp;",
            i({ class: "fas fa-edit" })
          ) +
          a(
            {
              class: "ms-1 me-3",
              href: `/viewedit/config/${encodeURIComponent(ename)}`,
            },
            "Configure&nbsp;",
            i({ class: "fas fa-cog" })
          );
        const vpack = await view_pack(all_views.find((v) => v.name === ename));
        edContents = renderForm(mkForm(vpack), req.csrfToken());
        break;
      case "page":
        cfg_link = a(
          { href: `/pageedit/edit/${encodeURIComponent(ename)}` },
          `${ename} ${etype}`
        );
        const ppack = await page_pack(all_pages.find((v) => v.name === ename));
        edContents = renderForm(mkForm(ppack), req.csrfToken());
        break;
      case "config":
        const config = all_configs.find((t) => t.name === ename);
        edContents =
          h4(config.label) +
          (config.blurb || "") +
          (config.sublabel || "") +
          renderForm(mkForm(config.value), req.csrfToken());
        break;
      case "trigger":
        const trigger = all_triggers.find((t) => t.name === ename);
        const trpack = await trigger_pack(trigger);
        cfg_link =
          `${ename} ${etype}` +
          a(
            {
              class: "ms-2",
              href: `/actions/edit/${trigger?.id}`,
            },
            "Edit&nbsp;",
            i({ class: "fas fa-edit" })
          ) +
          a(
            {
              class: "ms-1 me-3",
              href: `/actions/configure/${trigger?.id}`,
            },
            "Configure&nbsp;",
            i({ class: "fas fa-cog" })
          );

        edContents = renderForm(mkForm(trpack), req.csrfToken());
        break;
    }
    send_infoarch_page({
      res,
      req,
      active_sub: "Registry editor",
      contents: {
        widths: [3, 9],
        besides: [
          {
            type: "card",
            bodyClass: "p-1",
            title: "Entities",
            contents: div(
              form(
                { method: "GET", action: `/registry-editor` },
                div(
                  { class: "input-group search-bar mb-2" },
                  etype &&
                    input({ type: "hidden", name: "etype", value: etype }),
                  ename &&
                    input({ type: "hidden", name: "ename", value: ename }),
                  input({
                    type: "search",
                    class: "form-control search-bar ps-2 hasbl",
                    placeholder: "Search",
                    name: "q",
                    value: q,
                    "aria-label": "Search",
                    "aria-describedby": "button-search-submit",
                  }),
                  button(
                    {
                      class: "btn btn-outline-secondary search-bar",
                      type: "submit",
                    },
                    i({ class: "fas fa-search" })
                  )
                )
              ),
              // following https://iamkate.com/code/tree-views/
              ul(
                { class: "katetree ps-2" },
                li(
                  details(
                    { open: q || etype === "table" },
                    summary("Tables"),
                    ul(
                      { class: "ps-3" },
                      tables.map((t) => li_link("table", t.name))
                    )
                  )
                ),
                li(
                  details(
                    { open: q || etype === "view" },
                    summary("Views"),
                    ul(
                      { class: "ps-3" },
                      views.map((v) => li_link("view", v.name))
                    )
                  )
                ),
                li(
                  details(
                    { open: q || etype === "page" }, //
                    summary("Pages"),
                    ul(
                      { class: "ps-3" },
                      pages.map((p) => li_link("page", p.name))
                    )
                  )
                ),
                li(
                  details(
                    { open: q || etype === "trigger" }, //
                    summary("Triggers"),
                    ul(
                      { class: "ps-3" },
                      triggers.map((t) => li_link("trigger", t.name))
                    )
                  )
                ),
                li(
                  details(
                    { open: q || etype === "CONFIG" }, //
                    summary("Configuration"),
                    ul(
                      { class: "ps-3" },
                      configs.map((t) => li_link("config", t.name))
                    )
                  )
                )
              )
            ),
          },
          {
            type: "container",
            contents: {
              type: "card",
              title: cfg_link
                ? `Registry editor: ${cfg_link}`
                : ename && etype
                  ? `Registry editor: ${ename} ${etype}`
                  : "Registry editor",
              contents: edContents,
            },
          },
        ],
      },
    });
  })
);

router.post(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const { etype, ename, q } = req.query;
    const qlink = q ? `&q=${encodeURIComponent(q)}` : "";

    const entVal = JSON.parse((req.body || {}).regval);
    let pack = {
      plugins: [],
      tables: [],
      views: [],
      pages: [],
      triggers: [],
      config: {},
    };

    switch (etype) {
      case "table":
        pack.tables = [entVal];
        break;
      case "view":
        pack.views = [entVal];
        break;
      case "page":
        pack.pages = [entVal];
        break;
      case "trigger":
        pack.triggers = [entVal];
        break;
      case "config":
        pack.config[ename] = entVal;
        break;
    }
    await install_pack(pack);
    res.redirect(
      `/registry-editor?etype=${etype}&ename=${encodeURIComponent(
        ename
      )}${qlink}`
    );
  })
);
