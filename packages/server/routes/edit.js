/**
 * @category server
 * @module routes/edit
 * @subcategory routes
 */

const Router = require("express-promise-router");

const { error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");

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
  "/toggle/:tableName/:id/:field_name",
  error_catcher(async (req, res) => {
    const { tableName, id, field_name } = req.params;
    const { redirect } = req.query;
    // todo check that works after where change
    const table = await Table.findOne({ name: tableName });

    const row = await table.getRow(
      { [table.pk_name]: id },
      { forUser: req.user, forPublic: !req.user }
    );
    if (row)
      await table.updateRow(
        { [field_name]: !row[field_name] },
        id,
        req.user || { role_id: 10 }
      );

    if (req.xhr) res.send("OK");
    else if (req.get("referer")) res.redirect(req.get("referer"));
    else res.redirect(redirect || `/list/${table.name}`);
  })
);
