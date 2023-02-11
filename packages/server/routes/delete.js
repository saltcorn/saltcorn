/**
 * @category server
 * @module routes/delete
 * @subcategory routes
 */

const Router = require("express-promise-router");

const { error_catcher, is_relative_url } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");

/**
 * @type {object}
 * @const
 * @namespace deleteRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

/**
 * @name post/:name/:id
 * @function
 * @memberof module:routes/delete~deleteRouter
 * @function
 */
router.post(
  "/:tableName/:id",
  error_catcher(async (req, res) => {
    const { tableName, id } = req.params;
    const { redirect } = req.query;
    // todo check that works after where change
    const table = await Table.findOne({ name: tableName });
    const role = req.user && req.user.id ? req.user.role_id : 10;
    try {
      if (role <= table.min_role_write)
        await table.deleteRows({ id }, req.user || { role_id: 10 });
      else if (table.ownership_field_id && req.user) {
        const row = await table.getRow({ id });
        if (row && table.is_owner(req.user, row))
          await table.deleteRows({ id }, req.user || { role_id: 10 });
        else req.flash("error", req.__("Not authorized"));
      } else
        req.flash(
          "error",
          req.__("Not allowed to write to table %s", table.name)
        );
    } catch (e) {
      req.flash("error", e.message);
    }
    if (req.xhr) res.send("OK");
    else
      res.redirect(
        (is_relative_url(redirect) && redirect) || `/list/${table.name}`
      );
  })
);
