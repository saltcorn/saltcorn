const Router = require("express-promise-router");

const { setTenant, isAdmin } = require("./utils.js");
const Table = require("@saltcorn/data/models/table");
const {  post_btn } = require("@saltcorn/markup");
const {  div } = require("@saltcorn/markup/tags");

const router = new Router();
module.exports = router;

router.get("/", setTenant, isAdmin, async (req, res) => {
    res.sendWrap(`Admin`, div("Restart server. Try reloading the page after a few seconds after pressing this button.", post_btn('/admin/restart', 'Restart')));
})

router.post("/restart", setTenant, isAdmin, async (req, res) => {
  process.exit(0);
});
