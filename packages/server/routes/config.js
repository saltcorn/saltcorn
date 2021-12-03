/**
 * @category server
 * @module routes/config
 * @subcategory routes
 */
const Router = require("express-promise-router");

const Field = require("@saltcorn/data/models/field");
const File = require("@saltcorn/data/models/file");
const Table = require("@saltcorn/data/models/table");
const View = require("@saltcorn/data/models/view");
const Form = require("@saltcorn/data/models/form");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");

const {
  mkTable,
  renderForm,
  link,
  post_btn,
  post_delete_btn,
} = require("@saltcorn/markup");
const {
  getConfig,
  setConfig,
  getAllConfigOrDefaults,
  deleteConfig,
  configTypes,
  isFixedConfig,
} = require("@saltcorn/data/models/config");
const { table, tbody, tr, th, td, div } = require("@saltcorn/markup/tags");

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
