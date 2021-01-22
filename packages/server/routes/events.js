const Router = require("express-promise-router");
const { isAdmin, setTenant, error_catcher } = require("./utils.js");

const router = new Router();
module.exports = router;

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    res.redirect(`/actions`);
  })
);
