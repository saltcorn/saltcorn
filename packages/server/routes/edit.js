const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
const Form = require("@saltcorn/data/models/form");
const { setTenant, loggedIn, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const pluralize = require("pluralize");

const { renderForm } = require("@saltcorn/markup");

const router = new Router();
module.exports = router;

router.post(
  "/toggle/:name/:id/:field_name",
  setTenant,
  error_catcher(async (req, res) => {
    const { name, id, field_name } = req.params;
    const { redirect } = req.query;
    const table = await Table.findOne({ name });
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    if (role <= table.min_role_write) await table.toggleBool(+id, field_name);
    else
      req.flash(
        "error",
        req.__("Not allowed to write to table %s", table.name)
      );
    if (req.get("referer")) res.redirect(req.get("referer"));
    else res.redirect(redirect || `/list/${table.name}`);
  })
);
