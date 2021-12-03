/**
 * @category server
 * @module routes/events
 * @subcategory routes
 */

const Router = require("express-promise-router");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");

/**
 * @type {object}
 * @const
 * @namespace eventsRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name get
 * @function
 * @memberof module:routes/events~eventsRouter
 * @function
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    res.redirect(`/actions`);
  })
);
