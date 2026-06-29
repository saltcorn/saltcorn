/**
 * @category server
 * @module routes/events
 * @subcategory routes
 */

import Router from "express-promise-router";
import { isAdmin, setTenant, error_catcher } from "./utils.js";

/**
 * @type {object}
 * @const
 * @namespace eventsRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
export default router;

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
