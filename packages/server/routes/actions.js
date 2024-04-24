/**
 * Actions (Triggers) Handler
 * @category server
 * @module routes/actions
 * @subcategory routes
 */
const Router = require("express-promise-router");
const {
  isAdmin,
  error_catcher,
  addOnDoneRedirect,
  is_relative_url,
} = require("./utils.js");
const { ppVal } = require("@saltcorn/data/utils");
const { getState } = require("@saltcorn/data/db/state");
const Trigger = require("@saltcorn/data/models/trigger");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const { getTriggerList } = require("./common_lists");
const TagEntry = require("@saltcorn/data/models/tag_entry");
const Tag = require("@saltcorn/data/models/tag");
const db = require("@saltcorn/data/db");

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
  i,
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
    let triggers = await Trigger.findAllWithTableName();
    let filterOnTag;

    if (req.query._tag) {
      const tagEntries = await TagEntry.find({
        tag_id: +req.query._tag,
        not: { trigger_id: null },
      });
      const tagged_trigger_ids = new Set(
        tagEntries.map((te) => te.trigger_id).filter(Boolean)
      );
      triggers = triggers.filter((t) => tagged_trigger_ids.has(t.id));
      filterOnTag = await Tag.findOne({ id: +req.query._tag });
    }
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
              await getTriggerList(triggers, req, { filterOnTag }),
              a(
                {
                  href: "/actions/new",
                  class: "btn btn-primary",
                },
                req.__("Create trigger")
              )
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
  allActions.push("Multi-step action");
  const table_triggers = ["Insert", "Update", "Delete", "Validate"];
  const action_options = {};
  const actionsNotRequiringRow = actions
    .filter((a) => !a.requireRow)
    .map((t) => t.name);
  actionsNotRequiringRow.push("Multi-step action");

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
        attributes: { autofocus: true },
        sublabel: req.__("Name of action"),
      },
      {
        name: "when_trigger",
        label: req.__("When"),
        input_type: "select",
        required: true,
        options: Trigger.when_options.map((t) => ({ value: t, label: t })),
        sublabel: req.__("Event type which runs the trigger"),
        help: { topic: "Event types" },
        attributes: {
          explainers: {
            Often: req.__("Every 5 minutes"),
            Never: req.__(
              "Not scheduled but can be run as an action from a button click"
            ),
          },
        },
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
        name: "table_id",
        label: req.__("Table"),
        input_type: "select",
        options: [
          { value: "", label: "Table not set" },
          ...tables.map((t) => ({ value: t.id, label: t.name })),
        ],
        showIf: { when_trigger: "Never" },
        sublabel: req.__("Optionally associate a table with this trigger"),
      },
      {
        name: "channel",
        label: req.__("Time of day"),
        input_type: "time_of_day",
        showIf: { when_trigger: "Daily" },
        sublabel: req.__("UTC timezone"),
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
        help: { topic: "Actions" },
        attributes: {
          calcOptions: ["when_trigger", action_options],
        },
        showIf: {
          when_trigger: Trigger.when_options.filter((t) => t !== "Never"),
        },
        sublabel: req.__("The action to be taken when the trigger fires"),
      },
      {
        name: "action",
        label: req.__("Action"),
        type: "String",
        required: true,
        help: { topic: "Actions" },
        attributes: {
          options: actionsNotRequiringRow,
        },
        showIf: {
          when_trigger: "Never",
          table_id: "",
        },
        sublabel: req.__("The action to be taken when the trigger fires"),
      },
      {
        name: "action",
        label: req.__("Action"),
        type: "String",
        required: true,
        help: { topic: "Actions" },
        attributes: {
          options: allActions,
        },
        showIf: {
          when_trigger: "Never",
          table_id: tables.map((t) => t.id),
        },
        sublabel: req.__("The action to be taken when the trigger fires"),
      },
      {
        name: "description",
        label: req.__("Description"),
        type: "String",
        fieldview: "textarea",
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
      {
        name: "_raw_output",
        label: "Raw Output",
        parent_field: "configuration",
        sublabel: req.__("Do not wrap response in a success object"),
        type: "Bool",
        showIf: { when_trigger: ["API call"] },
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
      headers: [
        // date flat picker external component
        {
          script: `/static_assets/${db.connectObj.version_tag}/flatpickr.min.js`,
        },

        // css for date flat picker external component
        {
          css: `/static_assets/${db.connectObj.version_tag}/flatpickr.min.css`,
        },
      ],
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
      if (form.values.configuration)
        form.values.configuration = {
          ...trigger.configuration,
          ...form.values.configuration,
        };
      await Trigger.update(trigger.id, form.values); //{configuration: form.values});
      req.flash("success", req.__("Action information saved"));
      res.redirect(`/actions/`);
    }
  })
);

const getMultiStepForm = async (req, id, table) => {
  let stateActions = getState().actions;
  const stateActionKeys = Object.entries(stateActions)
    .filter(([k, v]) => !v.disableInList && (table || !v.requireRow))
    .map(([k, v]) => k);
  const actions = [...stateActionKeys];
  const triggers = Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
  });
  triggers.forEach((tr) => {
    actions.push(tr.name);
  });
  const actionConfigFields = [];
  for (const [name, action] of Object.entries(stateActions)) {
    if (!stateActionKeys.includes(name)) continue;
    const cfgFields = await getActionConfigFields(action, table);

    for (const field of cfgFields) {
      const cfgFld = {
        ...field,
        showIf: {
          step_action_name: name,
          ...(field.showIf || {}),
        },
      };
      if (cfgFld.input_type === "code") cfgFld.input_type = "textarea";
      actionConfigFields.push(cfgFld);
    }
  }
  const form = new Form({
    action: addOnDoneRedirect(`/actions/configure/${id}`, req),
    onChange: "saveAndContinue(this)",
    submitLabel: req.__("Done"),
    fields: [
      new FieldRepeat({
        name: "steps",
        fields: [
          {
            name: "step_action_name",
            label: req.__("Action"),
            type: "String",
            required: true,
            attributes: {
              options: actions,
            },
          },
          {
            name: "step_only_if",
            label: req.__("Only if..."),
            type: "String",
            class: "validate-expression",
          },
          ...actionConfigFields,
        ],
      }),
    ],
  });
  return form;
};

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
  "/configure/:idorname",
  isAdmin,
  error_catcher(async (req, res) => {
    const { idorname } = req.params;
    let trigger;
    let id = parseInt(idorname);
    if (id) trigger = await Trigger.findOne({ id });
    else trigger = await Trigger.findOne({ name: idorname });

    if (!trigger) {
      req.flash("warning", req.__("Action not found"));
      res.redirect(`/actions/`);
      return;
    }
    const action = getState().actions[trigger.action];
    // get table related to trigger
    const table = trigger.table_id
      ? Table.findOne({ id: trigger.table_id })
      : null;

    const subtitle =
      span(
        { class: "ms-3" },
        trigger.action,
        table ? ` on ` + a({ href: `/table/${table.name}` }, table.name) : ""
      ) +
      a(
        { href: `/actions/testrun/${id}`, class: "ms-2" },
        req.__("Test run") + "&nbsp;&raquo;"
      );
    if (trigger.action === "Multi-step action") {
      const form = await getMultiStepForm(req, id, table);
      form.values = trigger.configuration;
      send_events_page({
        res,
        req,
        active_sub: "Triggers",
        sub2_page: "Configure",
        page_title: req.__(`%s configuration`, trigger.name),
        contents: {
          type: "card",
          titleAjaxIndicator: true,
          title: req.__("Configure trigger %s", trigger.name),
          subtitle,
          contents: renderForm(form, req.csrfToken()),
        },
      });
    } else if (!action) {
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
      const actions = Trigger.find({
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
        page_title: trigger.name,
        contents: {
          type: "card",
          titleAjaxIndicator: true,
          title: req.__("Configure trigger %s", trigger.name),
          subtitle,
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
                      req.__("Save")
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
                  h6({ class: "mt-1" }, req.__("JavaScript code:")),
                  div(
                    { class: "mt-1" },

                    pre(
                      { class: "js-code-display" },
                      code({ id: "blockly_js_output" }, req.__("code here"))
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
      // get configuration fields
      const cfgFields = await getActionConfigFields(action, table, {
        mode: "trigger",
      });
      // create form
      const form = new Form({
        action: addOnDoneRedirect(`/actions/configure/${id}`, req),
        onChange: "saveAndContinue(this)",
        submitLabel: req.__("Done"),
        fields: cfgFields,
        ...(action.configFormOptions || {}),
      });
      // populate form values
      form.values = trigger.configuration;
      // send events page
      send_events_page({
        res,
        req,
        active_sub: "Triggers",
        sub2_page: "Configure",
        page_title: req.__(`%s configuration`, trigger.name),
        contents: {
          type: "card",
          titleAjaxIndicator: true,
          title: req.__("Configure trigger %s", trigger.name),
          subtitle,
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
      ? Table.findOne({ id: trigger.table_id })
      : null;
    let form;
    if (trigger.action === "Multi-step action") {
      form = await getMultiStepForm(req, id, table);
    } else {
      const cfgFields = await getActionConfigFields(action, table, {
        mode: "trigger",
      });
      form = new Form({
        action: `/actions/configure/${id}`,
        fields: cfgFields,
      });
    }
    form.validate(req.body);
    if (form.hasErrors) {
      if (req.xhr) {
        res.status(400).json({ error: form.errorSummary });
      } else
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
      await Trigger.update(trigger.id, {
        configuration: { ...trigger.configuration, ...form.values },
      });
      if (req.xhr) {
        res.json({ success: "ok" });
        return;
      }
      req.flash("success", req.__("Action configuration saved"));
      res.redirect(
        req.query.on_done_redirect &&
          is_relative_url(req.query.on_done_redirect)
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
        output.push(div(code(pre(text(s.map(ppVal).join(" "))))));
      },
      error(...s) {
        output.push(
          div(
            code(
              { style: "color:red;font-weight:bold;" },
              pre(text(s.map(ppVal).join(" ")))
            )
          )
        );
      },
    };
    let table, row;
    if (trigger.table_id) {
      table = Table.findOne({ id: trigger.table_id });
      row = await table.getRow(
        {},
        { orderBy: "RANDOM()", forUser: req.user, forPublic: !req.user }
      );
    }
    let runres;

    try {
      runres = await trigger.runWithoutRow({
        console: fakeConsole,
        table,
        row,
        req,
        ...(row || {}),
        Table,
        user: req.user,
      });
    } catch (e) {
      console.error(e);
      fakeConsole.error(e.message);
    }
    if (output.length === 0) {
      req.flash(
        "success",
        req.__(
          "Action %s run successfully with no console output",
          trigger.action
        ) + runres
          ? script(domReady(`common_done(${JSON.stringify(runres)})`))
          : ""
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
            runres
              ? script(domReady(`common_done(${JSON.stringify(runres)})`))
              : "",
            a(
              { href: `/actions`, class: "mt-4 btn btn-primary me-1" },
              "&laquo;&nbsp;" + req.__("back to actions")
            ),
            a(
              {
                href: `/actions/configure/${trigger.id}`,
                class: "mt-4 btn btn-primary me-1",
              },
              req.__("Configure action")
            ),
            a(
              {
                href: `/actions/testrun/${id}`,
                class: "ms-1 mt-4 btn btn-primary",
              },
              i({ class: "fas fa-redo me-1" }),
              req.__("Re-run")
            )
          ),
        },
      });
    }
  })
);
