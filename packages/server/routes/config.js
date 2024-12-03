/**
 * @category server
 * @module routes/config
 * @subcategory routes
 */
const Router = require("express-promise-router");


const { isAdmin, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");



/**
 * @type {object}
 * @const
 * @namespace configRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name post/delete/:key
 * @function
 * @memberof module:routes/config~configRouter
 * @function
 */
router.post(
  "/delete/:key",
  isAdmin,
  error_catcher(async (req, res) => {
    const { key } = req.params;
    await getState().deleteConfig(key);
    req.flash("success", req.__(`Configuration key %s deleted`, key));
    res.redirect(`/admin`);
  })
);
