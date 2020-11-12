const Router = require("express-promise-router");
const Crash = require("@saltcorn/data/models/crash");
const db = require("@saltcorn/data/db");
const { link, post_btn, mkTable } = require("@saltcorn/markup");
const {
  table,
  tbody,
  tr,
  td,
  text,
  pre,
  div,
  h3,
  p,
} = require("@saltcorn/markup/tags");

const { setTenant, isAdmin, error_catcher } = require("./utils.js");

const router = new Router();
module.exports = router;
const wrap = (req, cardTitle, response, lastBc) => ({
  above: [
    {
      type: "breadcrumbs",
      crumbs: [
        { text: req.__("Settings") },
        { text: req.__("Crash log"), href: lastBc && "/crashlog" },
        ...(lastBc ? [lastBc] : []),
      ],
    },
    {
      type: "card",
      title: cardTitle,
      contents: response,
    },
  ],
});
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const crashes = await Crash.find({}, { orderBy: "occur_at" });
    res.sendWrap(
      req.__("Crash log"),
      wrap(
        req,
        req.__("Crash log"),
        crashes.length === 0
          ? div(
              h3(req.__("No errors reported")),
              p(req.__("Everything is going extremely well."))
            )
          : mkTable(
              [
                {
                  label: req.__("Show"),
                  key: (r) => link(`/crashlog/${r.id}`, text(r.msg_short)),
                },
                { label: req.__("When"), key: (r) => r.reltime },
                ...(db.is_it_multi_tenant()
                  ? [{ label: req.__("Tenant"), key: "tenant" }]
                  : []),
              ],
              crashes
            )
      )
    );
  })
);

router.post(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const err = {
      stack: req.body.stack,
      message: `[JS] ${req.body.message}`,
    };
    await Crash.create(err, req);
    res.json({});
  })
);

router.get(
  "/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const crash = await Crash.findOne({ id });
    res.sendWrap(
      req.__("Crash log"),
      wrap(
        req,
        req.__("Crash log entry %s", id),
        table(
          { class: "table" },
          tbody(
            Object.entries(crash).map(([k, v]) =>
              tr(
                td(k),
                td(
                  pre(
                    text(
                      ["headers", "body"].includes(k)
                        ? JSON.stringify(v, null, 2)
                        : v
                    )
                  )
                )
              )
            )
          )
        ),
        { text: `${id}` }
      )
    );
  })
);
