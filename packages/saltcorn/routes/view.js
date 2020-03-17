const Router = require("express-promise-router");

const db = require("../db");
const viewtemplates = require("../viewtemplates");
const Form = require("../models/form");
const Field = require("../models/field");
const { div } = require("../markup/tags");
const { renderForm } = require("../markup");

const router = new Router();
module.exports = router;

router.get("/:viewname", async (req, res) => {
  const { viewname } = req.params;

  const viewrow = await db.selectOne("views", { name: viewname });
  if (!req.isAuthenticated() && !viewrow.is_public) {
    req.flash("danger", "Login required");
    res.redirect("/auth/login");
  } else {
    const view = viewtemplates[viewrow.viewtemplate];
    const display_state_form = view.display_state_form;
    const resp = await view.run(
      viewrow.table_id,
      viewname,
      viewrow.configuration,
      req.query
    );
    if (display_state_form) {
      const fields = await view.get_state_fields(
        viewrow.table_id,
        viewname,
        viewrow.configuration
      );
      const form = new Form({
        methodGET: true,
        action: `/view/${viewname}`,
        fields: fields.map(f => new Field(f)),
        submitLabel: "Apply",
        values: req.query
      });
      res.sendWrap(`${viewrow.name} view`, div(renderForm(form), resp));
    } else res.sendWrap(`${viewrow.name} view`, resp);
  }
});
