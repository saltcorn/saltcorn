const Router = require("express-promise-router");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");

const router = new Router();
module.exports = router;
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  settingsDropdown,
  post_dropdown_item,
} = require("@saltcorn/markup");
const actions = require("@saltcorn/data/base-plugin/actions");

const wrap = (req, cardTitle, response, lastBc) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: req.__("Settings") },
        { text: req.__("Actions"), href: lastBc && "/actions" },
        ...(lastBc ? [lastBc] : []),
      ],
    },
    ...response,
  ],
});

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const state = getState();
    let actions = [];
    Object.entries(state.actions).forEach(([k, v]) => {
      const hasConfig = !!v.configFields;
      actions.push({
        name: k,
        hasConfig,
      });
    });
    res.sendWrap(
      req.__("Actions"),
      wrap(req, req.__("Actions"), [
        {
          type: "card",
          title: req.__("Actions available"),
          contents: mkTable([{ label: req.__("Name"), key: "name" }], actions),
        },
      ])
    );
  })
);
