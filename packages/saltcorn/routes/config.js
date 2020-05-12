const Router = require("express-promise-router");

const Field = require("saltcorn-data/models/field");
const Form = require("saltcorn-data/models/form");
const { loggedIn } = require("./utils.js");
const Table = require("saltcorn-data/models/table");

const { mkTable, renderForm, link, post_btn } = require("saltcorn-markup");
const { getConfig, setConfig, getAllConfigOrDefaults, deleteConfig } = require("saltcorn-data/models/config");

const router = new Router();
module.exports = router;



//create -- new
router.get("/", loggedIn, async (req, res) => {
  const cfgs = await getAllConfigOrDefaults();
  const configTable = mkTable(
    [
      { label: "Key", key: r=>r.key },
      { label: "Value", key: r=>JSON.stringify(r.value) },
      {
        label: "Edit",
        key: r => link(`/config/edit/${r.key}`, "Edit")
      },
      {
        label: "Delete",
        key: r => post_btn(`/config/delete/${r.key}`, "Delete")
      }
    ],
    Object.entries(cfgs).map(([k,v])=>({key:k, ...v}))
  )
  res.sendWrap(`Configuration`, configTable);
});

router.post("/delete/:key", loggedIn, async (req, res) => {
    const { key } = req.params;
    await deleteConfig(key);
  res.redirect(`/config/`);

})  