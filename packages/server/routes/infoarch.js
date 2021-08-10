const Router = require("express-promise-router");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const {
  send_infoarch_page,
  send_admin_page,
  config_fields_form,
  save_config_from_form,
} = require("../markup/admin.js");
const { getState } = require("@saltcorn/data/db/state");
const { div, a, i } = require("@saltcorn/markup/tags");
const { mkTable, renderForm } = require("@saltcorn/markup");
const Form = require("@saltcorn/data/models/form");
const router = new Router();
module.exports = router;

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.redirect(`/menu`);
  })
);
const languageForm = (req) =>
  new Form({
    action: "/site-structure/localizer/save-lang",
    fields: [
      {
        name: "name",
        label: req.__("Name"),
        type: "String",
      },
      {
        name: "locale",
        label: req.__("Locale"),
        sublabel: "Locale identifier short code, e.g. en, fr etc. ",
        type: "String",
      },
      {
        name: "is_default",
        label: req.__("Default"),
        sublabel: "This is the default language in which the application is built",
        type: "Bool",
      },
    ],
  });
router.get(
  "/localizer",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const cfgLangs = getState().getConfig("localizer_languages");
    const langs = Object.entries(cfgLangs).map(([lang, v]) => ({ lang, ...v }));
    send_infoarch_page({
      res,
      req,
      active_sub: "Languages",
      contents: {
        type: "card",
        contents: div(
          mkTable(
            [
              {
                label: req.__("Language"),
                key: "lang",
              },
              {
                label: req.__("Edit"),
                key: (r) =>
                  a({ href: `/site-structure/localizer/edit/${r.lang}` }),
              },
            ],
            langs
          ),
          a(
            {
              href: "/site-structure/localizer/add-lang",
              class: "btn btn-primary mt-1",
            },
            i({ class: "fas fa-plus-square mr-1" }),
            req.__("Add language")
          )
        ),
      },
    });
  })
);

router.get(
  "/localizer/add-lang",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    send_infoarch_page({
      res,
      req,
      active_sub: "Languages",
      sub2_page: "New",
      contents: {
        type: "card",
        contents: [renderForm(languageForm(req), req.csrfToken())],
      },
    });
  })
);
