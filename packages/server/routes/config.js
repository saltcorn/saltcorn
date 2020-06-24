const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
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

//create -- new
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const cfgs = await getAllConfigOrDefaults();
    const canEdit = key => getState().types[configTypes[key].type];
    const hideValue = key =>
      configTypes[key] ? configTypes[key].type === "hidden" : true;
    const configTable = mkTable(
      [
        { label: "Key", key: r => r.label || r.key },
        {
          label: "Value",
          key: r => (hideValue(r.key) ? "..." : JSON.stringify(r.value))
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
    res.sendWrap(`Configuration`, configTable);
  })
);

const formForKey = (key, value) =>
  new Form({
    action: `/config/edit/${key}`,
    fields: [
      {
        name: key,
        label: configTypes[key].label || key,
        type: getState().types[configTypes[key].type],
        sublabel: configTypes[key].sublabel
      }
    ],
    ...(typeof value !== "undefined" && { values: { [key]: value } })
  });

router.get(
  "/edit/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;

    const value = await getConfig(key);
    res.sendWrap(
      `Edit configuration key ${key}`,
      renderForm(formForKey(key, value), req.csrfToken())
    );
  })
);

router.post(
  "/edit/:key",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;

    const form = formForKey(key);
    const valres = form.validate(req.body);
    if (valres.errors)
      res.sendWrap(
        `Edit configuration key ${key}`,
        renderForm(form, req.csrfToken())
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
