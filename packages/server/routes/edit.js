/**
 * @category server
 * @module routes/edit
 * @subcategory routes
 */

const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
const Form = require("@saltcorn/data/models/form");
const { loggedIn, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const pluralize = require("pluralize");

const { renderForm } = require("@saltcorn/markup");

/**
 * @type {object}
 * @const
 * @namespace editRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name post/toggle/:name/:id/:field_name
 * @function
 * @memberof module:routes/edit~editRouter
 * @function
 */
router.post(
  "/toggle/:name/:id/:field_name",
  error_catcher(async (req, res) => {
    const { name, id, field_name } = req.params;
    const { redirect } = req.query;
    const table = await Table.findOne({ name });
    const role = req.user && req.user.id ? req.user.role_id : 10;
    if (role <= table.min_role_write) await table.toggleBool(+id, field_name);
    else
      req.flash(
        "error",
        req.__("Not allowed to write to table %s", table.name)
      );
    if (req.xhr) res.send("OK");
    else if (req.get("referer")) res.redirect(req.get("referer"));
    else res.redirect(redirect || `/list/${table.name}`);
  })
);
