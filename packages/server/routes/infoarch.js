/**
 * @category server
 * @module routes/infoarch
 * @subcategory routes
 */

const Router = require("express-promise-router");
const {
  isAdmin,
  setTenant,
  error_catcher,
  isAdminOrHasConfigMinRole,
} = require("./utils.js");
const {
  send_infoarch_page,
  send_admin_page,
  config_fields_form,
  save_config_from_form,
  upload_language_pack,
} = require("../markup/admin.js");
const { getState } = require("@saltcorn/data/db/state");
const { div, a, i, text, button } = require("@saltcorn/markup/tags");
const { mkTable, renderForm, post_delete_btn } = require("@saltcorn/markup");
const Form = require("@saltcorn/data/models/form");
const Snapshot = require("@saltcorn/admin-models/models/snapshot");
const { stringify } = require("csv-stringify");
const csvtojson = require("csvtojson");
const { hasLLM, translate } = require("@saltcorn/data/translate");

/**
 * @type {object}
 * @const
 * @namespace infoarchRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name get
 * @function
 * @memberof module:routes/infoarch~infoarchRouter
 * @function
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    res.redirect(`/menu`);
  })
);

router.get(
  "/create-snapshot",
  isAdminOrHasConfigMinRole("min_role_create_snapshots"),
  error_catcher(async (req, res) => {
    send_infoarch_page({
      res,
      req,
      active_sub: "Snapshots",
      contents: {
        type: "card",
        contents: div(
          button(
            {
              class: "btn btn-outline-secondary",
              type: "button",
              onclick:
                "ajax_post('/site-structure/create-snapshot/'+prompt('Name of snapshot (optional)'))",
            },
            req.__("Snapshot now")
          )
        ),
      },
    });
  })
);

router.post(
  "/create-snapshot/:snapshotname",
  isAdminOrHasConfigMinRole("min_role_create_snapshots"),
  error_catcher(async (req, res) => {
    const { snapshotname } = req.params;
    if (snapshotname == "null") {
      //user clicked cancel on prompt
      res.json({ success: true });
      return;
    }

    try {
      const taken = await Snapshot.take_if_changed(snapshotname);
      if (taken) req.flash("success", req.__("Snapshot successful"));
      else
        req.flash("success", req.__("No changes detected, snapshot skipped"));
    } catch (e) {
      console.error(e);
      req.flash("error", e.message);
    }
    res.json({ reload_page: true });
  })
);

/**
 * @param {object} req
 * @returns {Form}
 */
const languageForm = (req, hasSaveButton) =>
  new Form({
    action: "/site-structure/localizer/save-lang",
    onChange: hasSaveButton ? undefined : "saveAndContinue(this)",
    noSubmitButton: !hasSaveButton,
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
        sublabel: req.__(
          "Locale identifier short code, e.g. en, zh, fr, ar etc. "
        ),
        type: "String",
        required: true,
      },
      {
        name: "is_default",
        label: req.__("Default language"),
        sublabel: req.__(
          "Is this the default language in which the application is built?"
        ),
        type: "Bool",
      },
    ],
  });

/**
 * @name get/localizer
 * @function
 * @memberof module:routes/infoarch~infoarchRouter
 * @function
 */
router.get(
  "/localizer",
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
                key: (r) =>
                  a(
                    { href: `/site-structure/localizer/edit/${r.locale}` },
                    r.name
                  ),
              },
              {
                label: req.__("Locale"),
                key: "locale",
              },
              {
                label: req.__("Default"),
                key: (r) =>
                  r.is_default
                    ? i({
                        class: "fas fa-check-circle text-success",
                      })
                    : "",
              },
              {
                label: req.__("Language CSV"),
                key: (r) =>
                  a(
                    {
                      href: `/site-structure/localizer/download-pack/${r.locale}`,
                    },
                    i({ class: "fas fa-download me-2" }),
                    req.__("Download")
                  ),
              },
              {
                label: req.__("Delete"),
                key: (r) =>
                  post_delete_btn(
                    `/site-structure/localizer/delete-lang/${r.locale}`,
                    req,
                    r.name
                  ),
              },
            ],
            Object.values(cfgLangs)
          ),
          div(
            { class: "d-flex mt-1" },
            a(
              {
                href: "/site-structure/localizer/add-lang",
                class: "btn btn-primary me-2",
              },
              i({ class: "fas fa-plus-square me-1" }),
              req.__("Add language")
            ),
            upload_language_pack(req)
          )
        ),
      },
    });
  })
);

router.get(
  "/localizer/download-pack/:lang",
  isAdmin,
  error_catcher(async (req, res) => {
    const { lang } = req.params;
    if (lang === "__proto__" || lang === "constructor") {
      res.redirect(`/`);
      return;
    }
    const cfgLangs = getState().getConfig("localizer_languages");

    if (!cfgLangs[lang]) {
      req.flash("error", req.__("Language not found"));
      return res.redirect(`/site-structure/localizer`);
    }
    const default_lang =
      Object.values(cfgLangs).find((lobj) => lobj.is_default)?.locale ||
      getState().getConfig("default_locale", "en");

    const cfgStrings = getState().getConfig("localizer_strings", {});
    const translation = cfgStrings[lang] || {};
    const strings = getState()
      .getStringsForI18n()
      .map((s) => ({ [default_lang]: s, [lang]: translation[s] || s }));
    res.type("text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${lang}.csv"`);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Pragma", "no-cache");
    stringify(strings, {
      header: true,
      columns: [default_lang, lang],
      quoted: true,
    }).pipe(res);
  })
);

router.post(
  "/localizer/upload-language-pack",
  isAdmin,
  setTenant, // TODO why is this needed?????
  error_catcher(async (req, res) => {
    if (req.files?.file?.tempFilePath) {
      const cfgLangs = getState().getConfig("localizer_languages");
      const default_lang =
        Object.values(cfgLangs).find((lobj) => lobj.is_default)?.locale ||
        getState().getConfig("default_locale", "en");
      const cfgStrings = getState().getConfigCopy("localizer_strings");

      try {
        const rows = await csvtojson().fromFile(req.files?.file?.tempFilePath);
        const langs = Object.keys(rows[0]).filter((k) => k !== default_lang);
        for (const lang of langs)
          for (const row of rows) {
            const defstring = row[default_lang];
            if (cfgStrings[lang]) cfgStrings[lang][defstring] = row[lang];
            else cfgStrings[lang] = { [defstring]: row[lang] };
          }
        await getState().setConfig("localizer_strings", cfgStrings);

        req.flash("success", `Updated languages: ${langs.join(", ")}`);
      } catch (e) {
        console.error(e);
        req.flash("error", e.message);
      }
    }
    res.redirect(`/site-structure/localizer`);
  })
);

/**
 * @name get/localizer/add-lang
 * @function
 * @memberof module:routes/infoarch~infoarchRouter
 * @function
 */
router.get(
  "/localizer/add-lang",
  isAdmin,
  error_catcher(async (req, res) => {
    send_infoarch_page({
      res,
      req,
      active_sub: "Languages",
      sub2_page: "New",
      contents: {
        type: "card",
        contents: [renderForm(languageForm(req, true), req.csrfToken())],
      },
    });
  })
);

/**
 * @name get/localizer/edit/:lang
 * @function
 * @memberof module:routes/infoarch~infoarchRouter
 * @function
 */
router.get(
  "/localizer/edit/:lang",
  isAdmin,
  error_catcher(async (req, res) => {
    const { lang } = req.params;
    const cfgLangs = getState().getConfig("localizer_languages");
    const form = languageForm(req);
    form.values = cfgLangs[lang];
    const { is_default } = form.values;
    const cfgStrings = getState().getConfig("localizer_strings", {});
    const translation = cfgStrings[lang] || {};
    const strings = getState()
      .getStringsForI18n()
      .map((s) => ({ in_default: s, translated: translation[s] || s }));
    send_infoarch_page({
      res,
      req,
      active_sub: "Languages",
      sub2_page: form.values.name || form.values.locale,
      contents: {
        above: [
          {
            type: "card",
            contents: [
              renderForm(form, req.csrfToken()),
              hasLLM() &&
                renderForm(
                  new Form({
                    fields: [],
                    action: `/site-structure/localizer/translate-llm/${lang}`,
                    submitLabel: req.__("Translate with LLM"),
                    onSubmit: "press_store_button(this)",

                    submitButtonClass: "btn-secondary",
                  }),
                  req.csrfToken()
                ),
            ],
          },
          !is_default && {
            type: "card",
            title: req.__("Strings"),
            contents: div(
              mkTable(
                [
                  {
                    label: req.__("In default language"),
                    key: "in_default",
                  },
                  {
                    label: req.__("In %s", form.values.name),
                    key: (r) =>
                      div(
                        {
                          "data-inline-edit-dest-url": `/site-structure/localizer/save-string/${lang}/${encodeURIComponent(
                            r.in_default
                          )}`,
                        },
                        r.translated
                      ),
                  },
                ],
                strings
              )
            ),
          },
        ],
      },
    });
  })
);


router.post(
  "/localizer/translate-llm/:lang/",
  isAdmin,
  error_catcher(async (req, res) => {
    const { lang, defstring } = req.params;
    if (
      lang === "__proto__" ||
      defstring === "__proto__" ||
      lang === "constructor"
    ) {
      res.redirect(`/`);
      return;
    }
    const cfgLangs = getState().getConfig("localizer_languages");

    if (!cfgLangs[lang]) {
      req.flash("error", req.__("Language not found"));
      return res.redirect(`/site-structure/localizer`);
    }
    const default_lang =
      Object.values(cfgLangs).find((lobj) => lobj.is_default)?.locale ||
      getState().getConfig("default_locale", "en");
    let count = 0;
    for (const defstring of getState().getStringsForI18n()) {
      const cfgStrings = getState().getConfigCopy("localizer_strings", {});
      if (
        cfgStrings[lang][defstring] &&
        cfgStrings[lang][defstring] !== defstring
      )
        continue;
      if (count >= 20) break;
      count += 1;
      const translated = await translate(defstring, lang, default_lang);
      if (cfgStrings[lang]) cfgStrings[lang][defstring] = translated;
      else cfgStrings[lang] = { [defstring]: translated };
      await getState().setConfig("localizer_strings", cfgStrings);
    }
    if (count == 20)
      req.flash(
        "success",
        req.__(
          `Translated %s strings. Click 'Translate with LLM' again to continue`, count
        )
      );
    else req.flash("success", req.__(`Finished translating %s strings.`, count));
    res.redirect(`/site-structure/localizer/edit/${lang}`);
  })
);

/**
 * @name post/localizer/save-string/:lang/:defstring
 * @function
 * @memberof module:routes/infoarch~infoarchRouter
 * @function
 */
router.post(
  "/localizer/save-string/:lang/:defstring",
  isAdmin,
  error_catcher(async (req, res) => {
    const { lang, defstring } = req.params;
    if (
      lang === "__proto__" ||
      defstring === "__proto__" ||
      lang === "constructor"
    ) {
      res.redirect(`/`);
      return;
    }
    const cfgStrings = getState().getConfigCopy("localizer_strings");
    if (cfgStrings[lang])
      cfgStrings[lang][defstring] = text((req.body || {}).value);
    else cfgStrings[lang] = { [defstring]: text((req.body || {}).value) };
    await getState().setConfig("localizer_strings", cfgStrings);
    res.redirect(`/site-structure/localizer/edit/${lang}`);
  })
);

/**
 * @name post/localizer/save-lang
 * @function
 * @memberof module:routes/infoarch~infoarchRouter
 * @function
 */
router.post(
  "/localizer/save-lang",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = languageForm(req);
    form.validate(req.body || {});
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

      if (!req.xhr)
        res.redirect(`/site-structure/localizer/edit/${lang.locale}`);
      else res.json({ success: "ok" });
    }
  })
);

/**
 * @name post/localizer/save-lang
 * @function
 * @memberof module:routes/infoarch~infoarchRouter
 * @function
 */
router.post(
  "/localizer/delete-lang/:lang",
  isAdmin,
  error_catcher(async (req, res) => {
    const { lang } = req.params;

    const cfgLangs = getState().getConfig("localizer_languages");
    if (cfgLangs[lang]) {
      delete cfgLangs[lang];
      await getState().setConfig("localizer_languages", cfgLangs);
    }
    if (!req.xhr) res.redirect(`/site-structure/localizer`);
    else res.json({ success: "ok" });
  })
);
