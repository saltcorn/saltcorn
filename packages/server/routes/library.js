const Library = require("@saltcorn/data/models/library");
const Router = require("express-promise-router");
const { setTenant, isAdmin, error_catcher } = require("./utils.js");

const router = new Router();
module.exports = router;

router.post(
  "/savefrombuilder",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    await Library.create(req.body);
    res.json({ success: "ok" });
  })
);
