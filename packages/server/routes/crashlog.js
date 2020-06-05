const Router = require("express-promise-router");
const Crash = require("@saltcorn/data/models/crash");
const db = require("@saltcorn/data/db");
const { link, post_btn, mkTable } = require("@saltcorn/markup");
const { table, tbody, tr, td, text, pre,div, h3,p } = require("@saltcorn/markup/tags");

const { setTenant, isAdmin } = require("./utils.js");

const router = new Router();
module.exports = router;

router.get("/", setTenant, isAdmin, async (req, res) => {
  const crashes = await Crash.find({});
  res.sendWrap(
    "Crash log",
    crashes.length ===0 ?
    div(h3("No errors reported"),p("Everything is going extremely well."))
    : mkTable(
      [
        { label: "Show", key: r => link(`/crashlog/${r.id}`, r.message) },
        { label: "When", key: r => r.reltime },
        ...(db.is_it_multi_tenant() ? [{ label: "Tenant", key: "tenant" }] : [])
      ],
      crashes
    )
  );
});

router.get("/:id", setTenant, isAdmin, async (req, res) => {
  const { id } = req.params;
  const crash = await Crash.findOne({ id });
  res.sendWrap(
    "Crash log",
    table(
      { class: "table" },
      tbody(
        Object.entries(crash).map(([k, v]) =>
          tr(
            td(k),
            td(pre(text(k === "headers" ? JSON.stringify(v, null, 2) : v)))
          )
        )
      )
    )
  );
});
