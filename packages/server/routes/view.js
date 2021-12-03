/**
 * @category server
 * @module routes/view
 * @subcategory routes
 */

const Router = require("express-promise-router");

const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const Page = require("@saltcorn/data/models/page");

const { div, text, i, a } = require("@saltcorn/markup/tags");
const { renderForm, link } = require("@saltcorn/markup");
const {
  isAdmin,
  error_catcher,
  scan_for_page_title,
} = require("../routes/utils.js");
const { add_edit_bar } = require("../markup/admin.js");

/**
 * @type {object}
 * @const
 * @namespace viewRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;

/**
 * @name get/:viewname
 * @function
 * @memberof module:routes/view~viewRouter
 * @function
 */
router.get(
  "/:viewname",
  error_catcher(async (req, res) => {
    const { viewname } = req.params;

    const view = await View.findOne({ name: viewname });
    const role = req.isAuthenticated() ? req.user.role_id : 10;

    if (!view) {
      req.flash("danger", req.__(`No such view: %s`, text(viewname)));
      res.redirect("/");
      return;
    }
    if (
      role > view.min_role &&
      !(await view.authorise_get({ query: req.query, req, ...view }))
    ) {
      req.flash("danger", req.__("Not authorized"));
      res.redirect("/");
      return;
    }
    const contents = await view.run_possibly_on_page(req.query, req, res);
    const title = scan_for_page_title(contents, view.name);
    res.sendWrap(
      title,
      add_edit_bar({
        role,
        title: view.name,
        what: req.__("View"),
        url: `/viewedit/edit/${encodeURIComponent(view.name)}`,
        contents,
        req,
      })
    );
  })
);

/**
 * @name post/:viewname/preview
 * @function
 * @memberof module:routes/view~viewRouter
 * @function
 */
router.post(
  "/:viewname/preview",
  isAdmin,
  error_catcher(async (req, res) => {
    const { viewname } = req.params;

    const view = await View.findOne({ name: viewname });
    if (!view) {
      res.send("");
      return;
    }
    let query = req.body || {};
    let row;
    let table;
    const sfs = await view.get_state_fields();
    for (const sf of sfs) {
      if (sf.required && !query[sf.name]) {
        if (!row) {
          if (!table)
            table = await Table.findOne(view.table_id || view.exttable_name);
          row = await table.getRow({});
        }
        if (row) query[sf.name] = row[sf.name];
      }
    }
    const contents = await view.run(query, { req, res });

    res.send(contents);
  })
);

/**
 * @name post/:viewname/:route
 * @function
 * @memberof module:routes/view~viewRouter
 * @function
 */
router.post(
  "/:viewname/:route",
  error_catcher(async (req, res) => {
    const { viewname, route } = req.params;
    const role = req.isAuthenticated() ? req.user.role_id : 10;

    const view = await View.findOne({ name: viewname });
    if (!view) {
      req.flash("danger", req.__(`No such view: %s`, text(viewname)));
      res.redirect("/");
    } else if (role > view.min_role) {
      req.flash("danger", req.__("Not authorized"));
      res.redirect("/");
    } else {
      await view.runRoute(route, req.body, res, { res, req });
    }
  })
);

/**
 * @name post/:viewname
 * @function
 * @memberof module:routes/view~viewRouter
 * @function
 */
router.post(
  "/:viewname",
  error_catcher(async (req, res) => {
    const { viewname } = req.params;
    const role = req.isAuthenticated() ? req.user.role_id : 10;

    const view = await View.findOne({ name: viewname });
    if (!view) {
      req.flash("danger", req.__(`No such view: %s`, text(viewname)));
      res.redirect("/");
    } else if (
      role > view.min_role &&
      !(await view.authorise_post({ body: req.body, req, ...view }))
    ) {
      req.flash("danger", req.__("Not authorized"));
      res.redirect("/");
    } else {
      await view.runPost(req.query, req.body, { res, req });
    }
  })
);
