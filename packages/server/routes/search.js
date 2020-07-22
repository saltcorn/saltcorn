const Router = require("express-promise-router");
const { span, h5, h4, nbsp, p, a, div } = require("@saltcorn/markup/tags");

const { getState } = require("@saltcorn/data/db/state");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const Form = require("@saltcorn/data/models/form");
const Table = require("@saltcorn/data/models/table");

const router = new Router();
module.exports = router;

const searchConfigForm = (tables, view) => {
  return new Form({
    action: "/search/config",
    fields: []
  });
};

router.get(
  "/config",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    var views = await View.find({}, { orderBy: "name" });
    const tables = await Table.find();
    const form = searchConfigForm(tables, views);
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
    const form = searchConfigForm(tables, views);
    const result = form.validate(req.body);

    if (result.success) {
    } else {
        res.sendWrap(`Search configuration`, renderForm(form, req.csrfToken()));
      }
  })
);
