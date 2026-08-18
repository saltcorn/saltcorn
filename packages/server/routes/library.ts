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
    const id = await Library.create(req.body || {});
    res.json({ success: "ok", id });
  })
);

/**
 * Saves edits made inside shared components, independent of which page or
 * view they were edited from. Used by the builder's "Next" button, which
 * otherwise only submits the page/view's own layout.
 * @name post/save-updates
 * @function
 * @memberof module:routes/library~libraryRouter
 */
router.post(
  "/save-updates",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const { libraryUpdates } = req.body || {};
    if (libraryUpdates?.length)
      await Library.saveLibraryUpdates(libraryUpdates);
    res.json({ success: "ok" });
  })
);

/**
 * @name get/content/:id
 * @function
 * @memberof module:routes/library~libraryRouter
 * Current content of a library item, fetched fresh (not from whatever the
 * builder's own page load happened to have) - a placed instance always
 * starts from the latest saved content of the shared component.
 */
router.get(
  "/content/:id",
  isAdmin,
  error_catcher(async (req: Req, res: Res) => {
    const { id } = req.params;
    const lib = await Library.findOne({ id });
    if (!lib) {
      res.status(404).json({ error: "Library item not found" });
      return;
    }
    res.json({
      id: lib.id,
      name: lib.name,
      icon: lib.icon,
      layout: lib.layout,
    });
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
