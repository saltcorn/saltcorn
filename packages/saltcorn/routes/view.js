const Router = require("express-promise-router");

const View = require("saltcorn-data/models/view");
const { div } = require("saltcorn-markup/tags");
const { renderForm } = require("saltcorn-markup");

const router = new Router();
module.exports = router;

router.get("/:viewname", async (req, res) => {
  const { viewname } = req.params;

  const view = await View.findOne({ name: viewname });
  if (!req.isAuthenticated() && !view.is_public) {
    req.flash("danger", "Login required");
    res.redirect("/auth/login");
  } else {
    const resp = await view.run(req.query);
    const state_form = await view.get_state_form(req.query);

    res.sendWrap(
      `${view.name} view`,
      div(state_form ? renderForm(state_form) : "", resp)
    );
  }
});
