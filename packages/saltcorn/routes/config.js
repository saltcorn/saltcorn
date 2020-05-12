const Router = require("express-promise-router");

const Field = require("saltcorn-data/models/field");
const Form = require("saltcorn-data/models/form");
const { isAdmin } = require("./utils.js");
const State = require("saltcorn-data/db/state");

const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const {
  getConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes
} = require("saltcorn-data/models/config");

const router = new Router();
module.exports = router;

//create -- new
router.get("/", isAdmin, async (req, res) => {
  const cfgs = await getAllConfigOrDefaults();
  const canEdit = key => State.types[configTypes[key].type];
  const configTable = mkTable(
    [
      { label: "Key", key: r => r.key },
      { label: "Value", key: r => JSON.stringify(r.value) },
      {
        label: "Edit",
        key: r => (canEdit(r.key) ? link(`/config/edit/${r.key}`, "Edit") : "")
      },
      {
        label: "Delete",
        key: r => post_btn(`/config/delete/${r.key}`, "Delete")
      }
    ],
    Object.entries(cfgs).map(([k, v]) => ({ key: k, ...v }))
  );
  res.sendWrap(`Configuration`, configTable);
});

const formForKey = (key, value) =>
  new Form({
    action: `/config/edit/${key}`,
    fields: [
      {
        name: key,
        label: configTypes[key].label || key,
        type: State.types[configTypes[key].type]
      }
    ],
    ...(typeof value !== "undefined" && { values: { [key]: value } })
  });

router.get("/edit/:key", isAdmin, async (req, res) => {
  const { key } = req.params;

  const value = await getConfig(key);
  res.sendWrap(
    `Edit configuration key ${key}`,
    renderForm(formForKey(key, value))
  );
});

router.post("/edit/:key", isAdmin, async (req, res) => {
  const { key } = req.params;

  const form = formForKey(key);
  form.validate(req.body);
  const valres = form.validate(req.body);
  if (valres.errors)
    res.sendWrap(`Edit configuration key ${key}`, renderForm(form));
  else {
    await setConfig(key, valres.success[key]);
    res.redirect(`/config/`);
  }
});

router.post("/delete/:key", isAdmin, async (req, res) => {
  const { key } = req.params;
  await deleteConfig(key);
  res.redirect(`/config/`);
});
