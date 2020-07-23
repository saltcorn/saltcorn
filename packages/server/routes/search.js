const Router = require("express-promise-router");
const { span, h5, h4, nbsp, p, a, div } = require("@saltcorn/markup/tags");

const { getState } = require("@saltcorn/data/db/state");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const { renderForm } = require("@saltcorn/markup");

const router = new Router();
module.exports = router;

const searchConfigForm = async (tables, views) => {
  var fields = [];
  var tbls_noviews = [];
  for (const t of tables) {
    var ok_views = [];
    for (const v of views.filter(v => v.table_id === t.id)) {
      const sfs = await v.get_state_fields();
      if (sfs.some(sf => sf.name === "id")) ok_views.push(v);
    }
    if (ok_views.length === 0) tbls_noviews.push(t.name);
    else
      fields.push({
        name: t.name,
        label: "Result preview for " + t.name,
        input_type: "select",
        options: ok_views.map(v => ({ value: v.name, label: v.name }))
      });
  }
  const blurb1 =
    "Set views for search results. Blank to omit table from global search. ";
  return new Form({
    action: "/search/config",
    blurb:
      blurb1 + tbls_noviews.length > 0
        ? `These tables had no suitable views: ${tbls_noviews.join()}.`
        : "",
    fields
  });
};

router.get(
  "/config",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    var views = await View.find({}, { orderBy: "name" });
    const tables = await Table.find();
    const form = await searchConfigForm(tables, views);
    form.values = getState().getConfig("globalSearch");
    res.sendWrap(`Search configuration`, renderForm(form, req.csrfToken()));
  })
);

router.post(
  "/config",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    var views = await View.find({}, { orderBy: "name" });
    const tables = await Table.find();
    const form = await searchConfigForm(tables, views);
    const result = form.validate(req.body);

    if (result.success) {
      await getState().setConfig("globalSearch", result.success);
      res.redirect("/search/config");
    } else {
      res.sendWrap(`Search configuration`, renderForm(form, req.csrfToken()));
    }
  })
);
