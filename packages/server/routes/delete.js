const Router = require("express-promise-router");

const { setTenant, loggedIn, error_catcher } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");

const router = new Router();

// export our router to be mounted by the parent application
module.exports = router;

router.post(
  "/:name/:id",
  setTenant,
  loggedIn,
  error_catcher(async (req, res) => {
    const { name, id } = req.params;
    const { redirect } = req.query;
    const table = await Table.findOne({ name });
    await table.deleteRows({ id });

    res.redirect(redirect || `/list/${table.name}`);
  })
);
