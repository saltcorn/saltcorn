/**
 * @category server
 * @module routes/library
 * @subcategory routes
 */

import Library from "@saltcorn/data/models/library";
import Router from "express-promise-router";
import { isAdmin, error_catcher } from "./utils.js";
import { send_infoarch_page } from "../markup/admin.js";
import { mkTable, post_delete_btn } from "@saltcorn/markup";
import { i } from "@saltcorn/markup/tags";
import { Req, Res } from "@saltcorn/types/base_types";

/**
 * @type {object}
 * @const
 * @namespace libraryRouter
 * @category server
 * @subcategory routes
 */
const router = Router();
export default router;

/**
 * @name post/savefrombuilder
 * @function
 * @memberof module:routes/library~libraryRouter
 * @function
 */
router.post(
  "/savefrombuilder",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    await Library.create(req.body || {});
    res.json({ success: "ok" });
  })
);

/**
 * @name get/list
 * @function
 * @memberof module:routes/library~libraryRouter
 * @function
 */
router.get(
  "/list",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const libs = (await Library.find({}))!;
    send_infoarch_page({
      res,
      req,
      active_sub: "Library",
      contents: {
        type: "card",
        title: req.__(
          "Library: component assemblies that can be used in the builder"
        ),
        contents: mkTable(
          [
            {
              label: req.__("Name"),
              key: "name", //(r: any) => link(`/table/${r.id || r.name}`, text(r.name)),
            },
            {
              label: req.__("Icon"),
              key: (r: any) => i({ class: r.icon }),
            },
            {
              label: req.__("Delete"),
              key: (r: any) =>
                post_delete_btn(`/library/delete/${r.id}`, req, r.name),
            },
          ],
          libs
        ),
      },
    });
  })
);

/**
 * @name post/delete/:id
 * @function
 * @memberof module:routes/library~libraryRouter
 * @function
 */
router.post(
  "/delete/:id",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const { id } = req.params;
    const t = (await Library.findOne({ id }))!;
    try {
      await t.delete();
      req.flash("success", req.__(`Library item %s deleted`, t.name));
      res.redirect(`/library/list`);
    } catch (err: any) {
      req.flash("error", err.message);
      res.redirect(`/library/list`);
    }
  })
);
