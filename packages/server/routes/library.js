/**
 * @category server
 * @module routes/library
 * @subcategory routes
 */

const Library = require("@saltcorn/data/models/library");
const Router = require("express-promise-router");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");
const { send_infoarch_page } = require("../markup/admin.js");
const { mkTable, post_delete_btn } = require("@saltcorn/markup");
const { i } = require("@saltcorn/markup/tags");

/**
 * @type {object}
 * @const
 * @namespace libraryRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name post/savefrombuilder
 * @function
 * @memberof module:routes/library~libraryRouter
 * @function
 */
router.post(
  "/savefrombuilder",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    await Library.create(req.body);
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
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const libs = await Library.find({});
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
              key: "name", //(r) => link(`/table/${r.id || r.name}`, text(r.name)),
            },
            {
              label: req.__("Icon"),
              key: (r) => i({ class: r.icon }),
            },
            {
              label: req.__("Delete"),
              key: (r) =>
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
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const t = await Library.findOne({ id });
    try {
      await t.delete();
      req.flash("success", req.__(`Library item %s deleted`, t.name));
      res.redirect(`/library/list`);
    } catch (err) {
      req.flash("error", err.message);
      res.redirect(`/library/list`);
    }
  })
);
