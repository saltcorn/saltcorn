/**
 * Actions (Triggers) Handler
 * @category server
 * @module routes/actions
 * @subcategory routes
 */
const Router = require("express-promise-router");
const { isAdmin, error_catcher, addOnDoneRedirect } = require("./utils.js");
const { getState } = require("@saltcorn/data/db/state");
const Trigger = require("@saltcorn/data/models/trigger");
const { getTriggerList } = require("./common_lists");

/**
 * @type {object}
 * @const
 * @namespace actionsRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;
const { renderForm, link } = require("@saltcorn/markup");
const Form = require("@saltcorn/data/models/form");
const {
  div,
  code,
  a,
  span,
  script,
  domReady,
  button,
  table,
  tbody,
  tr,
  td,
  h6,
  pre,
  text,
} = require("@saltcorn/markup/tags");
const Table = require("@saltcorn/data/models/table");
const { getActionConfigFields } = require("@saltcorn/data/plugin-helper");
const { send_events_page } = require("../markup/admin.js");
const User = require("@saltcorn/data/models/user");
const {
  blocklyImportScripts,
  blocklyToolbox,
} = require("../markup/blockly.js");

/**
 * @returns {Promise<object>}
 */
const getActions = async () => {
  return Object.entries(getState().actions).map(([k, v]) => {
    const hasConfig = !!v.configFields;
    const requireRow = !!v.requireRow;
    return {
      name: k,
      hasConfig,
      requireRow,
    };
  });
};

/**
 * Show list of Actions (Triggers) (HTTP GET)
 * @name get
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.get(
  "/",
  isAdmin,
  error_catcher(async (req, res) => {
    const triggers = await Trigger.findAllWithTableName();
    const actions = await getActions();
    send_events_page({
      res,
      req,
      active_sub: "Triggers",
      contents: {
        above: [
          {
            type: "card",
            title: req.__("Triggers"),
            contents: div(
              getTriggerList(triggers, req),
              link("/actions/new", req.__("Add trigger"))
            ),
          },
          {
            type: "card",
            contents: table(
              tbody(
                tr(
                  td({ class: "pe-2" }, req.__("Actions available")),
                  td(
                    actions
                      .map((a) => span({ class: "badge bg-primary" }, a.name))
                      .join("&nbsp;")
                  )
                ),
                tr(
                  td({ class: "pe-2" }, req.__("Event types")),
                  td(
                    Trigger.when_options
                      .map((a) => span({ class: "badge bg-secondary" }, a))
                      .join("&nbsp;")
                  )
                )
              )
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
  form_action = addOnDoneRedirect(form_action, req);
  const hasChannel = Object.entries(getState().eventTypes)
    .filter(([k, v]) => v.hasChannel)
    .map(([k, v]) => k);
  const allActions = actions.map((t) => t.name);
  const table_triggers = ["Insert", "Update", "Delete"];
  const action_options = {};
  const actionsNotRequiringRow = actions
    .filter((a) => !a.requireRow)
    .map((t) => t.name);
  Trigger.when_options.forEach((t) => {
    if (table_triggers.includes(t)) action_options[t] = allActions;
    else action_options[t] = actionsNotRequiringRow;
  });
  const form = new Form({
    action: form_action,
    fields: [
      {
        name: "name",
        label: req.__("Name"),
        type: "String",
        required: true,
        sublabel: req.__("Name of action"),
      },
      {
        name: "when_trigger",
        label: req.__("When"),
        input_type: "select",
        required: true,
        options: Trigger.when_options.map((t) => ({ value: t, label: t })),
        sublabel: req.__("Event type which runs the trigger"),
      },
      {
        name: "table_id",
        label: req.__("Table"),
        input_type: "select",
        options: [...tables.map((t) => ({ value: t.id, label: t.name }))],
        showIf: { when_trigger: table_triggers },
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
        name: "action",
        label: req.__("Action"),
        type: "String",
        required: true,
        attributes: {
          calcOptions: ["when_trigger", action_options],
        },
        sublabel: req.__("The action to be taken when the trigger fires"),
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
 * @name get/new
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.get(
  "/new",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await triggerForm(req);
    send_events_page({
      res,
      req,
      active_sub: "Triggers",
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
 * @name get/edit/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.get(
  "/edit/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });

    const form = await triggerForm(req, trigger);
    form.values = trigger;
    send_events_page({
      res,
      req,
      active_sub: "Triggers",
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
 * @name post/new
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.post(
  "/new",
  isAdmin,
  error_catcher(async (req, res) => {
    const form = await triggerForm(req);

    form.validate(req.body);
    if (form.hasErrors) {
      send_events_page({
        res,
        req,
        active_sub: "Triggers",
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
      res.redirect(addOnDoneRedirect(`/actions/configure/${id}`, req));
    }
  })
);

/**
 * POST for existing trigger (Save trigger)
 * @name /edit/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.post(
  "/edit/:id",
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
        active_sub: "Triggers",
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
 * @name get/configure/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.get(
  "/configure/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    if (!trigger) {
      req.flash("warning", req.__("Action not found"));
      res.redirect(`/actions/`);
      return;
    }
    const action = getState().actions[trigger.action];
    if (!action) {
      req.flash("warning", req.__("Action not found"));
      res.redirect(`/actions/`);
    } else if (trigger.action === "blocks") {
      const locale = req.getLocale();
      const form = new Form({
        action: addOnDoneRedirect(`/actions/configure/${id}`, req),
        fields: action.configFields,
        noSubmitButton: true,
        id: "blocklyForm",
      });
      form.values = trigger.configuration;
      const events = Trigger.when_options;
      const actions = await Trigger.find({
        when_trigger: { or: ["API call", "Never"] },
      });
      const tables = (await Table.find({})).map((t) => ({
        name: t.name,
        external: t.external,
      }));
      send_events_page({
        res,
        req,
        active_sub: "Triggers",
        sub2_page: "Configure",
        contents: {
          type: "card",
          title: req.__("Configure trigger"),
          contents: {
            widths: [8, 4],
            besides: [
              div(
                blocklyImportScripts({ locale }),
                div({ id: "blocklyDiv", style: "height: 600px; width: 100%;" }),
                blocklyToolbox(actions.length > 0)
              ),
              {
                above: [
                  div(
                    button(
                      { class: "btn btn-primary mt-2", id: "blocklySave" },
                      "Save"
                    ),
                    renderForm(form, req.csrfToken()),
                    script(
                      domReady(
                        `activate_blockly(${JSON.stringify({
                          events,
                          actions,
                          tables,
                        })})`
                      )
                    )
                  ),
                  h6({ class: "mt-1" }, "JavaScript code:"),
                  div(
                    { class: "mt-1" },

                    pre(
                      { class: "js-code-display" },
                      code({ id: "blockly_js_output" }, "code here")
                    )
                  ),
                ],
              },
            ],
          },
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
        action: addOnDoneRedirect(`/actions/configure/${id}`, req),
        onChange: "saveAndContinue(this)",
        submitLabel: req.__("Done"),
        fields: cfgFields,
      });
      // populate form values
      form.values = trigger.configuration;
      // send events page
      send_events_page({
        res,
        req,
        active_sub: "Triggers",
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
 * @name post/configure/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.post(
  "/configure/:id",
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
        active_sub: "Triggers",
        sub2_page: "Configure",
        contents: {
          type: "card",
          title: req.__("Configure trigger"),
          contents: renderForm(form, req.csrfToken()),
        },
      });
    } else {
      await Trigger.update(trigger.id, { configuration: form.values });
      if (req.xhr) {
        res.json({ success: "ok" });
        return;
      }
      req.flash("success", "Action configuration saved");
      res.redirect(
        req.query.on_done_redirect
          ? `/${req.query.on_done_redirect}`
          : "/actions/"
      );
    }
  })
);

/**
 * @name post/delete/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.post(
  "/delete/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    await trigger.delete();
    res.redirect(`/actions/`);
  })
);

/**
 * @name get/testrun/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.get(
  "/testrun/:id",
  isAdmin,
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    const output = [];
    const fakeConsole = {
      log(...s) {
        console.log(...s);
        output.push(div(code(pre(text(s.join(" "))))));
      },
      error(...s) {
        output.push(
          div(
            code(
              { style: "color:red;font-weight:bold;" },
              pre(text(s.join(" ")))
            )
          )
        );
      },
    };
    let table, row;
    if (trigger.table_id) {
      table = await Table.findOne({ id: trigger.table_id });
      row = await table.getRow({});
    }
    try {
      await trigger.runWithoutRow({
        console: fakeConsole,
        table,
        row,
        req,
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
        active_sub: "Triggers",
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
