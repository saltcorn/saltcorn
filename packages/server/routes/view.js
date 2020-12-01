const Router = require("express-promise-router");

const View = require("@saltcorn/data/models/view");
const Page = require("@saltcorn/data/models/page");

const { div, text, i, a } = require("@saltcorn/markup/tags");
const { renderForm, link } = require("@saltcorn/markup");
const { setTenant, error_catcher } = require("../routes/utils.js");
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
    if (role > view.min_role) {
      req.flash("danger", req.__("Not authorized"));
      res.redirect("/");
      return;
    }
    if (view.default_render_page) {
      const db_page = await Page.findOne({ name: view.default_render_page });
      if (db_page) {
        const contents = await db_page.run(req.query, { res, req });
        res.sendWrap(view.name, contents);
        return;
      }
    }
    const state = view.combine_state_and_default_state(req.query);
    const resp = await view.run(state, { res, req });
    const state_form = await view.get_state_form(state, req);
    const contents = div(
      state_form ? renderForm(state_form, req.csrfToken()) : "",
      resp
    );

    res.sendWrap(
      view.name,
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
    } else if (role > view.min_role) {
      req.flash("danger", req.__("Not authorized"));
      res.redirect("/");
    } else {
      await view.runPost(req.query, req.body, { res, req });
    }
  })
);
