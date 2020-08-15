const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
const Form = require("@saltcorn/data/models/form");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");

const { mkTable, renderForm, link, post_btn } = require("@saltcorn/markup");
const {
  getConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes
} = require("@saltcorn/data/models/config");

const router = new Router();
module.exports = router;

const wrap = (cardTitle, response, lastBc) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: "Settings" },
        { text: "Configuration", href: lastBc && "/config" },
        ...(lastBc ? [lastBc] : [])
      ]
    },
    {
      type: "card",
      title: cardTitle,
      contents: response
    }
  ]
});
//create -- new
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const cfgs = await getAllConfigOrDefaults();
    const files = await File.find({ min_role_read: 10 });
    const canEdit = key =>
      getState().types[configTypes[key].type] ||
      configTypes[key].type === "File";
    const hideValue = key =>
      configTypes[key] ? configTypes[key].type === "hidden" : true;
    const showFile = r => {
      const file = files.find(f => f.id == r.value);
      return file ? file.filename : "Unknown file";
    };
    const showValue = r =>
      hideValue(r.key)
        ? "..."
        : configTypes[r.key].type === "File"
        ? showFile(r)
        : JSON.stringify(r.value);
    const configTable = mkTable(
      [
        { label: "Key", key: r => r.label || r.key },
        {
          label: "Value",
          key: showValue
        },
        {
          label: "Edit",
          key: r =>
            canEdit(r.key) ? link(`/config/edit/${r.key}`, "Edit") : ""
        },
        {
          label: "Delete",
          key: r =>
            post_btn(`/config/delete/${r.key}`, "Delete", req.csrfToken())
        }
      ],
      Object.entries(cfgs).map(([k, v]) => ({ key: k, ...v }))
    );
    res.sendWrap(`Configuration`, wrap("Configuration", configTable));
  })
);

const formForKey = async (key, value) => {
  const form = new Form({
    action: `/config/edit/${key}`,
    fields: [
      {
        name: key,
        label: configTypes[key].label || key,
        type: configTypes[key].type,
        sublabel: configTypes[key].sublabel,
        attributes: configTypes[key].attributes
      }
    ],
    ...(typeof value !== "undefined" && { values: { [key]: value } })
  });
  await form.fill_fkey_options();
  return form;
};
router.get(
  "/edit/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;

    const value = await getConfig(key);
    const form = await formForKey(key, value);
    res.sendWrap(
      `Edit configuration key ${key}`,
      wrap(`Edit configuration key ${key}`, renderForm(form, req.csrfToken()), {
        text: key
      })
    );
  })
);

router.post(
  "/edit/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;

    const form = await formForKey(key);
    const valres = form.validate(req.body);
    if (valres.errors)
      res.sendWrap(
        `Edit configuration key ${key}`,
        wrap(
          `Edit configuration key ${key}`,
          renderForm(form, req.csrfToken()),
          { text: key }
        )
      );
    else {
      await getState().setConfig(key, valres.success[key]);
      req.flash("success", `Configuration key ${key} saved`);

      res.redirect(`/config/`);
    }
  })
);

router.post(
  "/delete/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;
    await getState().deleteConfig(key);
    req.flash("success", `Configuration key ${key} deleted`);
    res.redirect(`/config/`);
  })
);
