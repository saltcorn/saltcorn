const Router = require("express-promise-router");

const { setTenant, loggedIn, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.post(
  "/:name/:id",
  setTenant,
  error_catcher(async (req, res) => {
    const { name, id } = req.params;
    const { redirect } = req.query;
    const table = await Table.findOne({ name });
    const role = req.isAuthenticated() ? req.user.role_id : 10;
    try {
      if (role <= table.min_role_write) await table.deleteRows({ id });
      else if (table.ownership_field_id && req.user) {
        const row = await table.getRow({ id });
        if (row && (await table.is_owner(req.user, row)))
          await table.deleteRows({ id });
        else req.flash("error", req.__("Not authorized"));
      } else
        req.flash(
          "error",
          req.__("Not allowed to write to table %s", table.name)
        );
    } catch (e) {
      req.flash("error", e.message);
    }
    if (req.xhr) res.send("OK");
    else res.redirect(redirect || `/list/${table.name}`);
  })
);
