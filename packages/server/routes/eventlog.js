/**
 * Actions (Triggers) Handler
 * @category server
 * @module routes/eventlog
 * @subcategory routes
 */
const Router = require("express-promise-router");
const { isAdmin, error_catcher } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");
const Trigger = require("@saltcorn/data/models/trigger");

/**
 * @type {object}
 * @const
 * @namespace eventlogRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;
const {
  mkTable,
  renderForm,
  //link,
  //post_btn,
  //settingsDropdown,
  //post_dropdown_item,
  post_delete_btn,
  localeDateTime,
} = require("@saltcorn/markup");
const Form = require("@saltcorn/data/models/form");
const {
  div,
  //code,
  a,
  //span,
  tr,
  table,
  tbody,
  td,
  i,
  th,
  pre,
  text,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { send_events_page } = require("../markup/admin.js");
const EventLog = require("@saltcorn/data/models/eventlog");

/**
 * @param {object} req
 * @returns {Promise<Form>}
 */

const logSettingsForm = async (req) => {
  const hoursFuture = (nhrs) => {
    const t = new Date();
    t.setHours(t.getHours() + nhrs);
    return t;
  };
  const fields = [
    {
      input_type: "section_header",
      label: req.__("Periodic trigger timing (next event)"),
    },
    {
      name: "next_hourly_event",
      label: req.__("Hourly"),
      input_type: "date",
      attributes: { minDate: new Date(), maxDate: hoursFuture(2) },
    },
    {
      name: "next_daily_event",
      label: req.__("Daily"),
      input_type: "date",
      attributes: { minDate: new Date(), maxDate: hoursFuture(48) },
    },
    {
      name: "next_weekly_event",
      label: req.__("Weekly"),
      input_type: "date",
      attributes: { minDate: new Date(), maxDate: hoursFuture(24 * 7 * 2) },
    },
    {
      input_type: "section_header",
      label: req.__("Which events should be logged?"),
    },
  ];
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
        sublabel: req.__(
          "Channels to create events for. Separate by comma; leave blank for all"
        ),
        type: "String",
        showIf: { [w]: true },
      });
  }
  return new Form({
    action: "/eventlog/settings",
    noSubmitButton: true,
    onChange: "saveAndContinue(this)",
    fields,
  });
};

/**
 * @name get/settings
 * @function
 * @memberof module:routes/eventlog~eventlogRouter
 * @function
 */
router.get(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await logSettingsForm(req);
    form.values = getState().getConfig("event_log_settings", {});
    form.values.next_hourly_event = getState().getConfig(
      "next_hourly_event",
      {}
    );
    form.values.next_daily_event = getState().getConfig("next_daily_event", {});
    form.values.next_weekly_event = getState().getConfig(
      "next_weekly_event",
      {}
    );

    send_events_page({
      res,
      req,
      active_sub: "Settings",
      //sub2_page: "Events to log",
      contents: {
        type: "card",
        titleAjaxIndicator: true,
        title: req.__("Events and Trigger settings"),
        contents: renderForm(form, req.csrfToken()),
      },
    });
  })
);

/**
 * @name get/custom
 * @function
 * @memberof module:routes/eventlog~eventlogRouter
 * @function
 */
router.get(
  "/custom",
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
        contents:
          mkTable(
            [
              {
                label: req.__("Name"),
                key: "name",
              },
              {
                label: req.__("Channels"),
                key: (r) => (r.hasChannel ? req.__("Yes") : ""),
              },
              {
                label: req.__("Delete"),
                key: (r) =>
                  post_delete_btn(`/eventlog/custom/delete/${r.name}`, req),
              },
            ],
            cevs
          ) +
          a(
            {
              href: "/eventlog/custom/new",
              class: "btn btn-primary mt-1 me-3",
            },
            i({ class: "fas fa-plus-square me-1" }),
            req.__("Create custom event")
          ),
      },
    });
  })
);

/**
 * @returns {Form}
 */
const customEventForm = async (req) => {
  return new Form({
    action: "/eventlog/custom/new",
    submitButtonClass: "btn-outline-primary",
    onChange: "remove_outline(this)",
    fields: [
      {
        name: "name",
        label: req.__("Event Name"),
        type: "String",
        required: true,
      },
      {
        name: "hasChannel",
        label: req.__("Has channels?"),
        type: "Bool",
      },
    ],
  });
};
/**
 * @name get/custom/new
 * @function
 * @memberof module:routes/eventlog~eventlogRouter
 * @function
 */
router.get(
  "/custom/new",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await customEventForm(req);
    send_events_page({
      res,
      req,
      active_sub: "Custom",
      sub2_page: "New",
      contents: {
        type: "card",
        title: req.__("Create custom event"),
        contents: renderForm(form, req.csrfToken()),
      },
    });
  })
);

/**
 * @name post/custom/new
 * @function
 * @memberof module:routes/eventlog~eventlogRouter
 * @function
 */
router.post(
  "/custom/new",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await customEventForm(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_events_page({
        res,
        req,
        active_sub: "Custom",
        sub2_page: "New",
        contents: {
          type: "card",
          title: req.__("Create custom event"),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    } else {
      const cevs = getState().getConfig("custom_events", []);

      await getState().setConfig("custom_events", [...cevs, form.values]);
      await getState().refresh_config();

      res.redirect(`/eventlog/custom`);
    }
  })
);

/**
 * @name post/custom/delete/:name
 * @function
 * @memberof module:routes/eventlog~eventlogRouter
 * @function
 */
router.post(
  "/custom/delete/:name?",
  isAdmin,
  error_catcher(async (req, res) => {
    let { name } = req.params;
    if (!name) name = "";
    const cevs = getState().getConfig("custom_events", []);

    await getState().setConfig(
      "custom_events",
      cevs.filter((cev) => cev.name !== name)
    );
    await getState().refresh_plugins();
    res.redirect(`/eventlog/custom`);
  })
);

/**
 * @name post/settings
 * @function
 * @memberof module:routes/eventlog~eventlogRouter
 * @function
 */
router.post(
  "/settings",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await logSettingsForm(req);
    form.validate(req.body);
    if (form.hasErrors) {
      send_events_page({
        res,
        req,
        active_sub: "Settings",
        //sub2_page: "Events to log",
        contents: {
          type: "card",
          title: req.__("Events to log"),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    } else {
      for (const tm of ["hourly", "daily", "weekly"]) {
        const k = `next_${tm}_event`;
        if (form.values[k]) {
          await getState().setConfig(k, form.values[k]);
          delete form.values[k];
        }
      }

      await getState().setConfig("event_log_settings", form.values);

      if (!req.xhr) res.redirect(`/eventlog/settings`);
      else res.json({ success: "ok" });
    }
  })
);

/**
 * @name get
 * @function
 * @memberof module:routes/eventlog~eventlogRouter
 * @function
 */
router.get(
  "/",
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
      const nrows = await EventLog.count({});
      if (nrows > rows_per_page || current_page > 1) {
        page_opts.pagination = {
          current_page,
          pages: Math.ceil(nrows / rows_per_page),
          get_page_link: (n) => `gopage(${n}, ${rows_per_page})`,
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

/**
 * @name get/:id
 * @function
 * @memberof module:routes/eventlog~eventlogRouter
 * @function
 */
router.get(
  "/:id",
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
            ev.payload ? pre(text(JSON.stringify(ev.payload, null, 2))) : ""
          ),
      },
    });
  })
);
