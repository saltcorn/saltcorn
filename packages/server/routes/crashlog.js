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
const { send_events_page } = require("../markup/admin.js");

const router = new Router();
module.exports = router;

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const state = req.query,
      rows_per_page = 20,
      page_opts = {},
      current_page = parseInt(state._page) || 1,
      offset = (parseInt(state._page) - 1) * rows_per_page;

    const crashes = await Crash.find(
      {},
      { orderBy: "occur_at", orderDesc: true, limit: rows_per_page, offset }
    );
    if (crashes.length === rows_per_page || current_page > 1) {
      const nrows = await Crash.count();
      if (nrows > rows_per_page || current_page > 1) {
        page_opts.pagination = {
          current_page,
          pages: Math.ceil(nrows / rows_per_page),
          get_page_link: (n) => `javascript:gopage(${n}, ${rows_per_page})`,
        };
      }
    }
    send_events_page({
      res,
      req,
      active_sub: "Crash log",
      contents: {
        type: "card",
        contents:
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
                crashes,
                page_opts
              ),
      },
    });
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
    send_events_page({
      res,
      req,
      active_sub: "Crash log",
      sub2_page: crash.id,
      contents: {
        type: "card",
        class: "crashlog-entry",
        contents: table(
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
      },
    });
  })
);
