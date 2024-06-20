const Router = require("express-promise-router");

const db = require("@saltcorn/data/db");
const { mkTable, link, post_btn, renderForm } = require("@saltcorn/markup");
const {
  script,
  domReady,
  a,
  div,
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

router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const { etype, ename } = req.query;
    let edContents = "Choose an entity to edit";
    const tables = await Table.find({}, { orderBy: "name", nocase: true });
    const views = await View.find({}, { orderBy: "name", nocase: true });
    const pages = await Page.find({}, { orderBy: "name", nocase: true });
    const triggers = await Trigger.find({}, { orderBy: "name", nocase: true });
    const li_link = (etype1, ename1) =>
      li(
        a(
          {
            href: `/registry-editor?etype=${etype1}&ename=${encodeURIComponent(
              ename1
            )}`,
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
        )}`,

        values: { regval: JSON.stringify(jsonVal, null, 2) },
        fields: [
          {
            name: "regval",
            label: "",
            input_type: "code",
            attributes: { mode: "application/json" },
          },
        ],
      });
    switch (etype) {
      case "table":
        const tpack = await table_pack(tables.find((t) => t.name === ename));
        edContents = renderForm(mkForm(tpack), req.csrfToken());
        break;
      case "view":
        const vpack = await view_pack(views.find((v) => v.name === ename));
        edContents = renderForm(mkForm(vpack), req.csrfToken());
        break;
      case "page":
        const ppack = await page_pack(pages.find((v) => v.name === ename));
        edContents = renderForm(mkForm(ppack), req.csrfToken());
        break;
      case "trigger":
        const trpack = await trigger_pack(
          triggers.find((t) => t.name === ename)
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
            contents: ul(
              { class: "katetree ps-2" },
              li(
                details(
                  { open: etype === "table" },
                  summary("Tables"),
                  ul(
                    { class: "ps-3" },
                    tables.map((t) => li_link("table", t.name))
                  )
                )
              ),
              li(
                details(
                  { open: etype === "view" },
                  summary("Views"),
                  ul(
                    { class: "ps-3" },
                    views.map((v) => li_link("view", v.name))
                  )
                )
              ),
              li(
                details(
                  { open: etype === "page" }, //
                  summary("Pages"),
                  ul(
                    { class: "ps-3" },
                    pages.map((p) => li_link("page", p.name))
                  )
                )
              ),
              li(
                details(
                  { open: etype === "trigger" }, //
                  summary("Triggers"),
                  ul(
                    { class: "ps-3" },
                    triggers.map((t) => li_link("trigger", t.name))
                  )
                )
              )
            ),
          },
          {
            type: "card",
            title:
              ename && etype
                ? `Registry editor: ${ename} ${etype}`
                : "Registry editor",
            contents: edContents,
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
    const { etype, ename } = req.query;
    const entVal = JSON.parse(req.body.regval);
    let pack = { plugins: [], tables: [], views: [], pages: [], triggers: [] };

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
    }
    await install_pack(pack);
    res.redirect(
      `/registry-editor?etype=${etype}&ename=${encodeURIComponent(ename)}`
    );
  })
);
