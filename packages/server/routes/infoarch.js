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
        required: true,
      },
      {
        name: "locale",
        label: req.__("Locale"),
        sublabel: "Locale identifier short code, e.g. en, zh, fr, ar etc. ",
        type: "String",
        required: true,
      },
      {
        name: "is_default",
        label: req.__("Default"),
        sublabel:
          "Is this the default language in which the application is built?",
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
                key: "name",
              },
              {
                label: req.__("Locale"),
                key: "locale",
              },
              {
                label: req.__("Default"),
                key: "is_default", //(r) => (r.is_default ? "Y" : "N"),
              },
              {
                label: req.__("Edit"),
                key: (r) =>
                  a(
                    { href: `/site-structure/localizer/edit/${r.locale}` },
                    req.__("Edit")
                  ),
              },
            ],
            Object.values(cfgLangs)
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

router.get(
  "/localizer/edit/:lang",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { lang } = req.params;
    const cfgLangs = getState().getConfig("localizer_languages");
    const form = languageForm(req);
    form.values = cfgLangs[lang];
    send_infoarch_page({
      res,
      req,
      active_sub: "Languages",
      sub2_page: form.values.name || form.values.locale,
      contents: {
        type: "card",
        contents: [renderForm(form, req.csrfToken())],
      },
    });
  })
);
router.post(
  "/localizer/save-lang",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = languageForm(req);
    form.validate(req.body);
    if (form.hasErrors)
      send_infoarch_page({
        res,
        req,
        active_sub: "Languages",
        sub2_page: "New",
        contents: {
          type: "card",
          contents: [renderForm(form), req.csrfToken()],
        },
      });
    else {
      const lang = form.values;
      const cfgLangs = getState().getConfig("localizer_languages");
      await getState().setConfig("localizer_languages", {
        ...cfgLangs,
        [lang.locale]: lang,
      });
      res.redirect(`/site-structure/localizer`);
    }
  })
);
