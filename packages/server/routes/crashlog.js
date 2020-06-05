const Router = require("express-promise-router");
const Crash = require("@saltcorn/data/models/crash");
const db = require("@saltcorn/data/db");
const { renderForm, link, post_btn, mkTable } = require("@saltcorn/markup");

const { setTenant, isAdmin } = require("./utils.js");

const router = new Router();
module.exports = router;

router.get("/", setTenant, isAdmin, async (req, res) => {
    const crashes = await Crash.find({})
    console.log(crashes)
    res.sendWrap(
        "Crash log",
        mkTable(
          [
            { label: "Show", key: r=>link(`/crashlog/${r.id}`, r.message) },            
            { label: "When", key: r=> r.reltime},
            ...(db.is_it_multi_tenant() ? [{ label: "Tenant", key: "tenant" }] : []),
          ],
          crashes
        )
      );
    });
    