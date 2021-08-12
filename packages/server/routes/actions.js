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
  //  post_btn,
  //  settingsDropdown,
  //  post_dropdown_item,
  post_delete_btn,
  localeDateTime,
  //  localeDateTime,
} = require("@saltcorn/markup");
const actions = require("@saltcorn/data/base-plugin/actions");
const Form = require("@saltcorn/data/models/form");
const {
  div,
  code,
  a,
  span,
  script,
  domReady,
  button,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { getActionConfigFields } = require("@saltcorn/data/plugin-helper");
const { send_events_page } = require("../markup/admin.js");
const EventLog = require("@saltcorn/data/models/eventlog");
const User = require("@saltcorn/data/models/user");
const form = require("@saltcorn/markup/form");
const {
  blocklyImportScripts,
  blocklyToolbox,
} = require("../markup/blockly.js");

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
 * Show list of Actions (Triggers) (HTTP GET)
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
                    key: (r) => link(`/actions/edit/${r.id}`, req.__("Edit")),
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
              link("/actions/new", req.__("Add trigger"))
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
  const roleOptions = (await User.get_roles()).map((r) => ({
    value: r.id,
    label: r.role,
  }));
  const actions = await getActions();
  const tables = await Table.find({});
  let id;
  let form_action;
  if (typeof trigger !== "undefined") {
    id = trigger.id;
    form_action = `/actions/edit/${id}`;
  } else form_action = "/actions/new";
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
      {
        name: "min_role",
        label: req.__("Minimum role"),
        sublabel: req.__(
          "User must have this role or higher to make API call for action (trigger)"
        ),
        input_type: "select",
        showIf: { when_trigger: ["API call"] },
        options: roleOptions,
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
 * Show form to create new Trigger (get)
 */
router.get(
  "/new",
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
 * Show form to Edit existing Trigger (get)
 */
router.get(
  "/edit/:id",
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
 * POST for new or existing trigger (Save trigger)
 */
router.post(
  "/new",
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
 * POST for existing trigger (Save trigger)
 */
router.post(
  "/edit/:id",
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
    } else if (trigger.action === "blocks") {
      const locale = req.getLocale();
      const form = new Form({
        action: `/actions/configure/${id}`,
        fields: action.configFields,
        noSubmitButton: true,
        id: "blocklyForm",
      });
      form.values = trigger.configuration;
      const events = Trigger.when_options
      const actions = Object.keys(getState().actions)
      send_events_page({
        res,
        req,
        active_sub: "Actions",
        sub2_page: "Configure",
        contents: {
          type: "card",
          title: req.__("Configure trigger"),
          contents: div(
            blocklyImportScripts({locale}),
            div({ id: "blocklyDiv", style: "height: 600px; width: 100%;" }),
            blocklyToolbox(),
            button(
              { class: "btn btn-primary mt-2", id: "blocklySave" },
              "Save"
            ),
            renderForm(form, req.csrfToken()),
            script(domReady(`activate_blockly(${JSON.stringify({events, actions})})`))
          ),
        },
      });
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
