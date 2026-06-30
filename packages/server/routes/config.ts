/**
 * @category server
 * @module routes/config
 * @subcategory routes
 */
import Router from "express-promise-router";

import { isAdmin, error_catcher } from "./utils.js";
import { getState } from "@saltcorn/data/db/state";
import { Req, Res } from "@saltcorn/types/base_types";

/**
 * @type {object}
 * @const
 * @namespace configRouter
 * @category server
 * @subcategory routes
 */
const router = Router();
export default router;

/**
 * @name post/delete/:key
 * @function
 * @memberof module:routes/config~configRouter
 * @function
 */
router.post(
  "/delete/:key",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const { key } = req.params;
    await getState()!.deleteConfig(key);
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
  error_catcher(async (req: Req, res: Res) => {
    const state = getState()!;

    //TODO check this is a config key
    const validKeyName = (k: string) =>
      k !== "_csrf" && k !== "constructor" && k !== "__proto__";

    for (const [k, v] of Object.entries(req.body || {})) {
      if (
        !state.isFixedConfig(k) &&
        typeof v !== "undefined" &&
        validKeyName(k)
      ) {
        //TODO read value from type
        await state.setConfig(k, v);
      }
    }

    // checkboxes that are false are not sent in post body. Check here
    const { boolcheck } = req.query;
    const boolchecks: string[] =
      typeof boolcheck === "undefined"
        ? []
        : Array.isArray(boolcheck)
          ? (boolcheck as string[])
          : [boolcheck as string];
    for (const k of boolchecks) {
      if (typeof (req.body || {})[k] === "undefined" && validKeyName(k))
        await state.setConfig(k, false);
    }
    res.json({ success: "ok" });
  })
);
