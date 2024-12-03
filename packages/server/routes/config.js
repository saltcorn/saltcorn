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
    if (req.xhr) res.json({ success: "ok" });
    else {
      req.flash("success", req.__(`Configuration key %s deleted`, key));
      res.redirect(`/admin`);
    }
  })
);

router.post(
  "/save",
  isAdmin,
  error_catcher(async (req, res) => {
    const state = getState();

    //TODO check this is a config key
    const validKeyName = (k) =>
      k !== "_csrf" && k !== "constructor" && k !== "__proto__";

    for (const [k, v] of Object.entries(req.body)) {
      if (!state.isFixedConfig(k) && typeof v !== "undefined" && validKeyName(k)) {
        //TODO read value from type
        await state.setConfig(k, v);
      }
    }

    // checkboxes that are false are not sent in post body. Check here
    const { boolcheck } = req.query;
    const boolchecks =
      typeof boolcheck === "undefined"
        ? []
        : Array.isArray(boolcheck)
        ? boolcheck
        : [boolcheck];
    for (const k of boolchecks) {
      if (typeof req.body[k] === "undefined" && validKeyName(k))
        await state.setConfig(k, false);
    }
    res.json({ success: "ok" });
  })
);
