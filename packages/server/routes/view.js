const Router = require("express-promise-router");

const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const Page = require("@saltcorn/data/models/page");

const { div, text, i, a } = require("@saltcorn/markup/tags");
const { renderForm, link } = require("@saltcorn/markup");
const {
  setTenant,
  isAdmin,
  error_catcher,
  scan_for_page_title,
} = require("../routes/utils.js");
const { add_edit_bar } = require("../markup/admin.js");

const router = new Router();
module.exports = router;

router.get(
  "/:viewname",
  setTenant,
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
        role: req.xhr ? 10 : role,
        title: view.name,
        what: req.__("View"),
        url: `/viewedit/edit/${encodeURIComponent(view.name)}`,
        contents,
      })
    );
  })
);

router.post(
  "/:viewname/preview",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { viewname } = req.params;

    const view = await View.findOne({ name: viewname });
    if (!view) {
      res.send("");
      return;
    }
    let query = {};
    let row;
    let table;
    const sfs = await view.get_state_fields();
    for (const sf of sfs) {
      if (sf.required) {
        if (!row) {
          if (!table)
            table = await Table.findOne(view.table_id || view.exttable_name);
          row = await table.getRow({});
        }
        if(row) query[sf.name] = row[sf.name];
      }
    }
    const contents = await view.run(query, { req, res });

    res.send(contents);
  })
);

router.post(
  "/:viewname/:route",
  setTenant,
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

router.post(
  "/:viewname",
  setTenant,
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
