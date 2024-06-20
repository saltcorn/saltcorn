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
} = require("@saltcorn/admin-models/models/pack");
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
    let edContents = "Registry editor: choose an entity to edit";
    const views = await View.find({}, { orderBy: "name", nocase: true });
    const pages = await Page.find({}, { orderBy: "name", nocase: true });
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
        blurb: `Registry editor: ${ename} ${etype}`,
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
      case "view":
        const vpack = await view_pack(views.find((v) => v.name === ename));
        edContents = renderForm(mkForm(vpack), req.csrfToken());
        break;
    }
    send_infoarch_page({
      res,
      req,
      active_sub: "Registry editor",
      contents: [
        {
          type: "card",
          contents: {
            besides: [
              {
                type: "blank",
                contents: ul(
                  { class: "katetree" },
                  li(
                    details(
                      { open: etype === "page" }, //
                      summary("Pages"),
                      ul(pages.map((p) => li_link("page", p.name)))
                    )
                  ),
                  li(
                    details(
                      { open: etype === "view" },
                      summary("Views"),
                      ul(views.map((v) => li_link("view", v.name)))
                    )
                  )
                ),
              },
              { type: "blank", contents: edContents },
            ],
            widths: etype && ename ? [2, 10] : [3, 9],
          },
        },
      ],
    });
  })
);
