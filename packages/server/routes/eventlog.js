/**
 * Actions (Triggers) Handler
 *
 */
const Router = require("express-promise-router");
const {
  isAdmin,
  setTenant,
  error_catcher,
  get_base_url,
} = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");
const Trigger = require("@saltcorn/data/models/trigger");

const router = new Router();
module.exports = router;
const {
  mkTable,
  renderForm,
  link,
  post_btn,
  settingsDropdown,
  post_dropdown_item,
  post_delete_btn,
  localeDateTime,
} = require("@saltcorn/markup");
const Form = require("@saltcorn/data/models/form");
const {
  div,
  code,
  a,
  span,
  tr,
  table,
  tbody,
  td,
  th,
  pre,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { send_events_page } = require("../markup/admin.js");
const EventLog = require("@saltcorn/data/models/eventlog");

const logSettingsForm = async (req) => {
  const fields = [];
  for (const w of Trigger.when_options) {
    fields.push({
      name: w,
      label: w,
      type: "Bool",
    });
    if (EventLog.hasTable(w)) {
      const tables = await Table.find({}, { orderBy: "name" });
      for (const table of tables) {
        fields.push({
          name: `${w}_${table.name}`,
          label: `&nbsp;&nbsp;&nbsp;${w} ${table.name}`,
          type: "Bool",
          showIf: { [w]: true },
        });
      }
    }
    if (EventLog.hasChannel(w))
      fields.push({
        name: w + "_channel",
        label: w + " channel",
        sublabel:
          "Channels to create events for. Separate by comma; leave blank for all",
        type: "String",
        showIf: { [w]: true },
      });
  }
  return new Form({
    action: "/eventlog/settings",
    blurb: req.__("Which events should be logged?"),
    submitButtonClass: "btn-outline-primary",
    onChange: "remove_outline(this)",
    fields,
  });
};

router.get(
  "/settings",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await logSettingsForm(req);
    form.values = getState().getConfig("event_log_settings", {});
    send_events_page({
      res,
      req,
      active_sub: "Log settings",
      //sub2_page: "Events to log",
      contents: {
        type: "card",
        title: req.__("Events to log"),
        contents: renderForm(form, req.csrfToken()),
      },
    });
  })
);

router.get(
  "/custom",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const cevs = getState().getConfig("custom_events", []);
    send_events_page({
      res,
      req,
      active_sub: "Custom",
      //sub2_page: "Events to log",
      contents: {
        type: "card",
        title: req.__("Custom Events"),
        contents: mkTable(
          [
            {
              label: req.__("Name"),
              key: "name",
            },
            { label: req.__("Channels"), key: "hasChannel" },
            {
              label: req.__("Delete"),
              key: (r) =>
                post_delete_btn(`/eventlog/custom/delete/${r.name}`, req),
            },
          ],
          cevs
        ),
      },
    });
  })
);

router.post(
  "/settings",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await logSettingsForm(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_events_page({
        res,
        req,
        active_sub: "Log settings",
        //sub2_page: "Events to log",
        contents: {
          type: "card",
          title: req.__("Events to log"),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    } else {
      await getState().setConfig("event_log_settings", form.values);

      res.redirect(`/eventlog/settings`);
    }
  })
);

router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const state = req.query,
      rows_per_page = 20,
      page_opts = { hover: true },
      current_page = parseInt(state._page) || 1,
      offset = (parseInt(state._page) - 1) * rows_per_page;

    const evlog = await EventLog.find(
      {},
      { orderBy: "occur_at", orderDesc: true, limit: rows_per_page, offset }
    );
    if (evlog.length === rows_per_page || current_page > 1) {
      const nrows = await EventLog.count();
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
      active_sub: "Event log",
      //sub2_page: "Events to log",
      contents: {
        type: "card",
        title: req.__("Event log"),
        contents: mkTable(
          [
            {
              label: req.__("When"),
              key: (r) => a({ href: `/eventlog/${r.id}` }, r.reltime),
            },
            { label: req.__("Type"), key: "event_type" },
            { label: req.__("Channel"), key: "channel" },
          ],
          evlog,
          page_opts
        ),
      },
    });
  })
);

router.get(
  "/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const ev = await EventLog.findOneWithUser(id);
    send_events_page({
      res,
      req,
      active_sub: "Event log",
      sub2_page: ev.id,
      contents: {
        type: "card",
        contents:
          table(
            { class: "table eventlog" },
            tbody(
              tr(th(req.__("When")), td(localeDateTime(ev.occur_at))),
              tr(th(req.__("Type")), td(ev.event_type)),
              tr(th(req.__("Channel")), td(ev.channel)),
              tr(th(req.__("User")), td(ev.email))
            )
          ) +
          div(
            { class: "eventpayload" },
            ev.payload ? pre(JSON.stringify(ev.payload, null, 2)) : ""
          ),
      },
    });
  })
);
