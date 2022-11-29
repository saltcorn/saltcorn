/**
 * @category server
 * @module routes/view
 * @subcategory routes
 */

const Router = require("express-promise-router");

const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");

const { text } = require("@saltcorn/markup/tags");
const {
  isAdmin,
  error_catcher,
  scan_for_page_title,
  setTenant,
} = require("../routes/utils.js");
const { add_edit_bar } = require("../markup/admin.js");
const { InvalidConfiguration } = require("@saltcorn/data/utils");
const { getState } = require("@saltcorn/data/db/state");

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
  ["/:viewname", "/:viewname/*"],
  error_catcher(async (req, res) => {
    const { viewname } = req.params;
    const query = { ...req.query };
    const view = await View.findOne({ name: viewname });
    const role = req.user && req.user.id ? req.user.role_id : 10;
    const state = getState();
    state.log(3, `Route /view/${viewname} user=${req.user?.id}`);
    if (!view) {
      req.flash("danger", req.__(`No such view: %s`, text(viewname)));
      state.log(2, `View ${viewname} not found`);
      res.redirect("/");
      return;
    }

    view.rewrite_query_from_slug(query, req.params);
    if (
      role > view.min_role &&
      !(await view.authorise_get({ query, req, ...view }))
    ) {
      req.flash("danger", req.__("Not authorized"));
      state.log(2, `View ${viewname} not authorized`);
      res.redirect("/");
      return;
    }
    const contents = await view.run_possibly_on_page(query, req, res);
    const title = scan_for_page_title(contents, view.name);
    res.sendWrap(
      title,
      add_edit_bar({
        role,
        title: view.name,
        what: req.__("View"),
        url: `/viewedit/edit/${encodeURIComponent(view.name)}`,
        cfgUrl: `/viewedit/config/${encodeURIComponent(view.name)}`,
        contents,
        req,
        viewtemplate: view.viewtemplate,
        table: view.table_id || view.exttable_name,
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
            // todo check after where change
            table = await Table.findOne(
              view.table_id
                ? { id: view.table_id }
                : { name: view.exttable_name }
            );
          row = await table.getRow({});
        }
        if (row) query[sf.name] = row[sf.name];
      }
    }
    const contents = await view.run(query, { req, res, isPreview: true });

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
    const role = req.user && req.user.id ? req.user.role_id : 10;
    const state = getState();
    state.log(
      3,
      `Route /view/${viewname} viewroute ${route} user=${req.user?.id}`
    );

    const view = await View.findOne({ name: viewname });
    if (!view) {
      req.flash("danger", req.__(`No such view: %s`, text(viewname)));
      state.log(2, `View ${viewname} not found`);
      res.redirect("/");
    } else if (role > view.min_role) {
      req.flash("danger", req.__("Not authorized"));
      state.log(2, `View ${viewname} viewroute ${route} not authorized`);

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
  ["/:viewname", "/:viewname/*"],
  setTenant,
  error_catcher(async (req, res) => {
    const { viewname } = req.params;
    const role = req.user && req.user.id ? req.user.role_id : 10;
    const query = { ...req.query };
    const state = getState();
    state.log(3, `Route /view/${viewname} POST user=${req.user?.id}`);
    const view = await View.findOne({ name: viewname });
    if (!view) {
      req.flash("danger", req.__(`No such view: %s`, text(viewname)));
      state.log(2, `View ${viewname} not found`);
      res.redirect("/");
      return;
    }
    view.rewrite_query_from_slug(query, req.params);

    if (
      role > view.min_role &&
      !(await view.authorise_post({ body: req.body, req, ...view }))
    ) {
      req.flash("danger", req.__("Not authorized"));
      state.log(2, `View ${viewname} POST not authorized`);

      res.redirect("/");
    } else if (!view.runPost) {
      throw new InvalidConfiguration(
        `View ${text(viewname)} with template ${
          view.viewtemplate
        } does not supply a POST handler`
      );
    } else {
      await view.runPost(query, req.body, { res, req });
    }
  })
);
