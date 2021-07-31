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
} = require("@saltcorn/markup");
const actions = require("@saltcorn/data/base-plugin/actions");
const Form = require("@saltcorn/data/models/form");
const { div, code, a, span } = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { getActionConfigFields } = require("@saltcorn/data/plugin-helper");
const { send_events_page } = require("../markup/admin.js");
const EventLog = require("@saltcorn/data/models/eventlog");

const getActions = async () => {
  return Object.entries(getState().actions).map(([k, v]) => {
    const hasConfig = !!v.configFields;
    return {
      name: k,
      hasConfig,
    };
  });
};
/**
 * Actions (Trigger) List (GET)
 */
router.get(
  "/",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const triggers = await Trigger.findAllWithTableName();
    const actions = await getActions();
    const base_url = get_base_url(req);
    send_events_page({
      res,
      req,
      active_sub: "Actions",
      contents: {
        above: [
          {
            type: "card",
            title: req.__("Actions available"),
            contents: div(
              actions
                .map((a) => span({ class: "badge badge-primary" }, a.name))
                .join("&nbsp;")
            ),
          },
          {
            type: "card",
            title: req.__("Event types"),
            contents: div(
              Trigger.when_options
                .map((a) => span({ class: "badge badge-secondary" }, a))
                .join("&nbsp;")
            ),
          },
          {
            type: "card",
            title: req.__("Triggers"),
            contents: div(
              mkTable(
                [
                  { label: req.__("Name"), key: "name" },
                  { label: req.__("Action"), key: "action" },
                  {
                    label: req.__("Table or Channel"),
                    key: (r) => r.table_name || r.channel,
                  },
                  {
                    label: req.__("When"),
                    key: (a) =>
                      a.when_trigger === "API call"
                        ? `API: ${base_url}api/action/${a.name}`
                        : a.when_trigger,
                  },
                  {
                    label: req.__("Test run"),
                    key: (r) =>
                      r.table_id
                        ? ""
                        : link(`/actions/testrun/${r.id}`, req.__("Test run")),
                  },
                  {
                    label: req.__("Edit"),
                    key: (r) =>
                      link(`/actions/trigger/${r.id}`, req.__("Edit")),
                  },
                  {
                    label: req.__("Configure"),
                    key: (r) =>
                      link(`/actions/configure/${r.id}`, req.__("Configure")),
                  },
                  {
                    label: req.__("Delete"),
                    key: (r) => post_delete_btn(`/actions/delete/${r.id}`, req),
                  },
                ],
                triggers,
                { hover: true }
              ),
              link("/actions/trigger/new", req.__("Add trigger"))
            ),
          },
        ],
      },
    });
  })
);
/**
 * Trigger Edit Form
 * @param req
 * @param trigger
 * @returns {Promise<Form>}
 */
const triggerForm = async (req, trigger) => {
  const actions = await getActions();
  const tables = await Table.find({});
  let id;
  let form_action;
  if (typeof trigger !== "undefined") {
    id = trigger.id;
    form_action = `/actions/trigger/${id}`;
  } else form_action = "/actions/trigger";
  const hasChannel = Object.entries(getState().eventTypes)
    .filter(([k, v]) => v.hasChannel)
    .map(([k, v]) => k);
  const form = new Form({
    action: form_action,
    fields: [
      {
        name: "name",
        label: req.__("Name"),
        type: "String",
        sublabel: req.__("Name of action"),
      },
      {
        name: "description",
        label: req.__("Description"),
        type: "String",
        sublabel: req.__(
          "Description allows you to give more information about the action"
        ),
      },
      {
        name: "action",
        label: req.__("Action"),
        input_type: "select",
        required: true,
        options: actions.map((t) => ({ value: t.name, label: t.name })),
        sublabel: req.__("The action to be taken when the trigger fires"),
      },
      {
        name: "when_trigger",
        label: req.__("When"),
        input_type: "select",
        required: true,
        options: Trigger.when_options.map((t) => ({ value: t, label: t })),
        sublabel: req.__("Condition under which the trigger will fire"),
      },
      {
        name: "table_id",
        label: req.__("Table"),
        input_type: "select",
        options: [...tables.map((t) => ({ value: t.id, label: t.name }))],
        showIf: { when_trigger: ["Insert", "Update", "Delete"] },
        sublabel: req.__(
          "The table for which the trigger condition is checked."
        ),
      },
      {
        name: "channel",
        label: req.__("Channel"),
        type: "String",
        sublabel: req.__("Leave blank for all channels"),
        showIf: { when_trigger: hasChannel },
      },
    ],
  });
  // if (trigger) {
  //     form.hidden("id");
  //     form.values = trigger;
  //  }
  return form;
};
/**
 * Create new Trigger (get)
 */
router.get(
  "/trigger/new",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await triggerForm(req);
    send_events_page({
      res,
      req,
      active_sub: "Actions",
      sub2_page: "New",
      contents: {
        type: "card",
        title: req.__("New trigger"),
        contents: renderForm(form, req.csrfToken()),
      },
    });
  })
);
/**
 * Edit Trigger (get)
 */
router.get(
  "/trigger/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });

    const form = await triggerForm(req, trigger);
    form.values = trigger;
    send_events_page({
      res,
      req,
      active_sub: "Actions",
      sub2_page: "Edit",
      contents: {
        type: "card",
        title: req.__("Edit trigger %s", id),
        contents: renderForm(form, req.csrfToken()),
      },
    });
  })
);
/**
 * POST for new trigger
 */
router.post(
  "/trigger",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await triggerForm(req);

    form.validate(req.body);
    if (form.hasErrors) {
      send_events_page({
        res,
        req,
        active_sub: "Actions",
        sub2_page: "Edit",
        contents: {
          type: "card",
          title: req.__("Edit trigger"),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    } else {
      let id;
      if (form.values.id) {
        id = form.values.id;
        await Trigger.update(id, form.values);
      } else {
        const tr = await Trigger.create(form.values);
        id = tr.id;
      }
      res.redirect(`/actions/configure/${id}`);
    }
  })
);
/**
 * POST for existing trigger
 */
router.post(
  "/trigger/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    // todo check that trigger exists

    const form = await triggerForm(req, trigger);

    form.validate(req.body);
    if (form.hasErrors) {
      send_events_page({
        res,
        req,
        active_sub: "Actions",
        sub2_page: "Edit",
        contents: {
          type: "card",
          title: req.__("Edit trigger"),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    } else {
      await Trigger.update(trigger.id, form.values); //{configuration: form.values});
      req.flash("success", "Action information saved");
      res.redirect(`/actions/`);
    }
  })
);
/**
 * Edit Trigger configuration (GET)
 *
 * /actions/configure/:id
 *
 * - get configuration fields
 * - create form
 */
router.get(
  "/configure/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    const action = getState().actions[trigger.action];
    if (!action) {
      req.flash("warning", req.__("Action not found"));
      res.redirect(`/actions/`);
    } else if (!action.configFields) {
      req.flash("warning", req.__("Action not configurable"));
      res.redirect(`/actions/`);
    } else {
      // get table related to trigger
      const table = trigger.table_id
        ? await Table.findOne({ id: trigger.table_id })
        : null;
      // get configuration fields
      const cfgFields = await getActionConfigFields(action, table);
      // create form
      const form = new Form({
        action: `/actions/configure/${id}`,
        fields: cfgFields,
      });
      // populate form values
      form.values = trigger.configuration;
      // send events page
      send_events_page({
        res,
        req,
        active_sub: "Actions",
        sub2_page: "Configure",
        contents: {
          type: "card",
          title: req.__("Configure trigger"),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    }
  })
);
/**
 * Configure Trigger (POST)
 */
router.post(
  "/configure/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    const action = getState().actions[trigger.action];
    const table = trigger.table_id
      ? await Table.findOne({ id: trigger.table_id })
      : null;
    const cfgFields = await getActionConfigFields(action, table);
    const form = new Form({
      action: `/actions/configure/${id}`,
      fields: cfgFields,
    });
    form.validate(req.body);
    if (form.hasErrors) {
      send_events_page({
        res,
        req,
        active_sub: "Actions",
        sub2_page: "Configure",
        contents: {
          type: "card",
          title: req.__("Configure trigger"),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    } else {
      await Trigger.update(trigger.id, { configuration: form.values });
      req.flash("success", "Action configuration saved");
      res.redirect(`/actions/`);
    }
  })
);
router.post(
  "/delete/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    await trigger.delete();
    res.redirect(`/actions/`);
  })
);
router.get(
  "/testrun/:id",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    const output = [];
    const fakeConsole = {
      log(...s) {
        output.push(div(code(s.join(" "))));
      },
      error(...s) {
        output.push(
          div(code({ style: "color:red;font-weight:bold;" }, s.join(" ")))
        );
      },
    };
    let table, row;
    if (trigger.table_id) {
      table = await Table.findOne(trigger.table_id);
      row = await table.getRow({});
    }
    try {
      await trigger.runWithoutRow({
        console: fakeConsole,
        table,
        row,
        ...(row || {}),
        Table,
        user: req.user,
      });
    } catch (e) {
      fakeConsole.error(e.message);
    }
    if (output.length === 0) {
      req.flash(
        "success",
        req.__(
          "Action %s run successfully with no console output",
          trigger.action
        )
      );
      res.redirect(`/actions/`);
    } else {
      send_events_page({
        res,
        req,
        active_sub: "Actions",
        sub2_page: "Test run output",
        contents: {
          type: "card",
          title: req.__("Test run output"),
          contents: div(
            div({ class: "testrunoutput" }, output),

            a(
              { href: `/actions`, class: "mt-4 btn btn-primary" },
              "&laquo;&nbsp;" + req.__("back to actions")
            )
          ),
        },
      });
    }
  })
);

const logSettingsForm = (req) =>
  new Form({
    action: "/actions/logsettings",
    blurb: req.__("Which events should be logged?"),
    submitButtonClass: "btn-outline-primary",
    onChange: "remove_outline(this)",
    fields: Trigger.when_options.map((w) => ({
      name: w,
      label: w,
      type: "Bool",
    })),
  });

router.get(
  "/logsettings",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = logSettingsForm(req);
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

router.post(
  "/logsettings",
  setTenant,
  isAdmin,
  error_catcher(async (req, res) => {
    const form = logSettingsForm(req);
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

      res.redirect(`/actions/logsettings`);
    }
  })
);

router.get(
  "/eventlog",
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
           
            { label: req.__("When"), key: (r) => r.reltime },
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
