/**
 * Actions (Triggers) Handler
 * @category server
 * @module routes/actions
 * @subcategory routes
 */
const Router = require("express-promise-router");
const {
  isAdmin,
  isAdminOrHasConfigMinRole,
  error_catcher,
  addOnDoneRedirect,
  is_relative_url,
} = require("./utils.js");
const { ppVal, jsIdentifierValidator } = require("@saltcorn/data/utils");
const { getState } = require("@saltcorn/data/db/state");
const Trigger = require("@saltcorn/data/models/trigger");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const { getTriggerList } = require("./common_lists");
const TagEntry = require("@saltcorn/data/models/tag_entry");
const WorkflowStep = require("@saltcorn/data/models/workflow_step");
const WorkflowRun = require("@saltcorn/data/models/workflow_run");
const WorkflowTrace = require("@saltcorn/data/models/workflow_trace");
const Tag = require("@saltcorn/data/models/tag");
const db = require("@saltcorn/data/db");
const MarkdownIt = require("markdown-it"),
  md = new MarkdownIt();
const {
  getWorkflowStepUserForm,
} = require("@saltcorn/data/web-mobile-commons");

/**
 * @type {object}
 * @const
 * @namespace actionsRouter
 * @category server
 * @subcategory routes
 */
const router = new Router();
module.exports = router;
const {
  renderForm,
  link,
  mkTable,
  localeDateTime,
  post_delete_btn,
} = require("@saltcorn/markup");
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
  th,
  text,
  i,
  ul,
  li,
  h2,
  h4,
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
 * Show list of Actions (Triggers) (HTTP GET)
 * @name get
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.get(
  "/",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
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
    const actions = Trigger.abbreviated_actions;
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
  const actions = Trigger.abbreviated_actions;
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

  const allActions = Trigger.action_options({
    notRequireRow: false,
    workflow: true,
  });
  const table_triggers = ["Insert", "Update", "Delete", "Validate"];
  const action_options = {};
  const actionsNotRequiringRow = Trigger.action_options({
    notRequireRow: true,
    workflow: true,
  });

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
        label: req.__("Time to run"),
        input_type: "time_of_week",
        showIf: { when_trigger: "Weekly" },
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
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const form = await triggerForm(req);
    if (req.query.table) {
      const table = Table.findOne({ name: req.query.table });
      if (table) form.values.table_id = table.id;
    }

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
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });

    const form = await triggerForm(req, trigger);
    form.values = trigger;
    form.onChange = `saveAndContinue(this)`;
    send_events_page({
      res,
      req,
      active_sub: "Triggers",
      sub2_page: "Edit",
      contents: {
        type: "card",
        title: req.__("Edit trigger %s", id),
        titleAjaxIndicator: true,
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
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const form = await triggerForm(req);

    form.validate(req.body || {});
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
      Trigger.emitEvent("AppChange", `Trigger ${form.values.name}`, req.user, {
        entity_type: "Trigger",
        entity_name: form.values.name,
      });
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
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    // todo check that trigger exists

    const form = await triggerForm(req, trigger);

    form.validate(req.body || {});
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
      Trigger.emitEvent("AppChange", `Trigger ${trigger.name}`, req.user, {
        entity_type: "Trigger",
        entity_name: trigger.name,
      });
      if (req.xhr) {
        res.json({ success: "ok" });
        return;
      }
      req.flash("success", req.__("Action information saved"));
      res.redirect(`/actions/`);
    }
  })
);

const getWorkflowConfig = async (req, id, table, trigger) => {
  let steps = await WorkflowStep.find(
    { trigger_id: trigger.id },
    { orderBy: "id" }
  );
  const initial_step = steps.find((step) => step.initial_step);
  if (initial_step)
    steps = [initial_step, ...steps.filter((s) => !s.initial_step)];
  const trigCfgForm = new Form({
    action: addOnDoneRedirect(`/actions/configure/${id}`, req),
    onChange: "saveAndContinue(this)",
    noSubmitButton: true,
    formStyle: "vert",
    fields: [
      {
        name: "save_traces",
        label: "Save step traces for each run",
        type: "Bool",
      },
    ],
  });
  trigCfgForm.values = trigger.configuration;
  let copilot_form = "";

  if (getState().functions.copilot_generate_workflow) {
    copilot_form = renderForm(
      new Form({
        action: `/actions/gen-copilot/${id}`,
        values: { description: trigger.description || "" },
        submitLabel: "Generate workflow with copilot",
        formStyle: "vert",
        fields: [
          {
            name: "description",
            label: "Description",
            type: "String",
            fieldview: "textarea",
          },
        ],
      }),
      req.csrfToken()
    );
  }
  return (
    copilot_form +
    pre({ class: "mermaid" }, WorkflowStep.generate_diagram(steps)) +
    script(
      { defer: "defer" },
      `function tryAddWFNodes() {
  const ns = $("g.node");
  if(!ns.length) setTimeout(tryAddWFNodes, 200)
  else {
    $("i.add-btw-nodes").on("click", (e)=>{
      const $e = $(e.target || e);
      const cls = $e.attr('class');
      const idnext = cls.split(" ").find(c=>c.startsWith("btw-nodes-")).
          substr(10);
      const [idprev, nmnext] = idnext.split("-");
      if(cls.includes("init-for-body"))
        location.href = '/actions/stepedit/${trigger.id}?after_step_for='+idprev+'&before_step='+nmnext;
      else
        location.href = '/actions/stepedit/${trigger.id}?after_step='+idprev+'&before_step='+nmnext;
    })
    $("g.node").on("click", (e)=>{
       const $e = $(e.target || e).closest("g.node")
       const cls = $e.attr('class')
       if(!cls) return;      
       //console.log(cls)
       if(cls.includes("wfstep")) {
       const id = cls.split(" ").find(c=>c.startsWith("wfstep")).
          substr(6);
       location.href = '/actions/stepedit/${trigger.id}/'+id;
       }
       if(cls.includes("wfaddstart")) {
         location.href = '/actions/stepedit/${trigger.id}?initial_step=true';
       } else if(cls.includes("wfadd")) {
         const id = cls.split(" ").find(c=>c.startsWith("wfadd")).
          substr(5);
         location.href = '/actions/stepedit/${trigger.id}?after_step='+id;
       }
      //console.log($e.attr('class'), id)
     })
  }
}
window.addEventListener('DOMContentLoaded',tryAddWFNodes)`
    ) +
    a(
      {
        href: `/actions/stepedit/${trigger.id}${
          initial_step ? "" : "?initial_step=true"
        }`,
        class: "btn btn-secondary",
      },
      i({ class: "fas fa-plus me-2" }),
      "Add step"
    ) +
    a(
      {
        href: `/actions/runs/?trigger=${trigger.id}`,
        class: "d-block",
      },
      "Show runs &raquo;"
    ) +
    renderForm(trigCfgForm, req.csrfToken())
  );
};

const getWorkflowStepForm = async (
  trigger,
  req,
  step_id,
  after_step,
  before_step,
  after_step_for
) => {
  const table = trigger.table_id ? Table.findOne(trigger.table_id) : null;
  const actionExplainers = {};

  let stateActions = getState().actions;
  const stateActionKeys = Object.entries(stateActions)
    .filter(([k, v]) => !v.disableInWorkflow)
    .map(([k, v]) => k);

  const actionConfigFields = [];
  for (const [name, action] of Object.entries(stateActions)) {
    if (!stateActionKeys.includes(name)) continue;

    if (action.description) actionExplainers[name] = action.description;

    try {
      const cfgFields = await getActionConfigFields(action, table, {
        mode: "workflow",
        req,
      });

      for (const field of cfgFields) {
        let cfgFld;
        if (field.isRepeat)
          cfgFld = new FieldRepeat({
            ...field,
            showIf: {
              wf_action_name: name,
              ...(field.showIf || {}),
            },
          });
        else
          cfgFld = {
            ...field,
            showIf: {
              wf_action_name: name,
              ...(field.showIf || {}),
            },
          };
        //if (cfgFld.input_type === "code") cfgFld.input_type = "textarea";
        actionConfigFields.push(cfgFld);
      }
    } catch {
      //ignore
    }
  }
  actionConfigFields.push({
    label: "Subcontext",
    name: "subcontext",
    type: "String",
    sublabel:
      "Optional. A key on the current workflow's context, the values of which will be the called workflow's context.",
    showIf: {
      wf_action_name: Trigger.find({ action: "Workflow" }).map((wf) => wf.name),
    },
  });
  const nonWfTriggerNames = Trigger.find({})
    .filter((tr) => tr.action !== "Workflow")
    .map((wf) => wf.name);

  actionConfigFields.push({
    label: "Row expression",
    name: "row_expr",
    type: "String",
    class: "validate-expression",
    sublabel:
      "Expression for the object to set the <code>row</code> value to inside the action. If blank, set to whole context",
    showIf: {
      wf_action_name: nonWfTriggerNames,
    },
  });

  const builtInActionExplainers = WorkflowStep.builtInActionExplainers({
    api_call: trigger.when_trigger == "API call",
  });
  const actionsNotRequiringRow = Trigger.action_options({
    notRequireRow: true,
    noMultiStep: true,
    apiNeverTriggers: true,
    builtInLabel: "Workflow Actions",
    builtIns: Object.keys(builtInActionExplainers),
    forWorkflow: true,
  });
  const triggers = Trigger.find({
    when_trigger: { or: ["API call", "Never"] },
  });
  triggers.forEach((tr) => {
    if (tr.description) actionExplainers[tr.name] = tr.description;
  });
  Object.assign(actionExplainers, builtInActionExplainers);
  actionConfigFields.push(
    ...(await WorkflowStep.builtInActionConfigFields({ trigger }))
  );

  const form = new Form({
    action: addOnDoneRedirect(`/actions/stepedit/${trigger.id}`, req),
    onChange: step_id ? "saveAndContinueIfValid(this)" : undefined,
    submitLabel: step_id ? req.__("Done") : undefined,
    additionalButtons: step_id
      ? [
          {
            label: req.__("Delete"),
            class: "btn btn-outline-danger",
            onclick: `ajax_post('/actions/delete-step/${+step_id}')`,
            afterSave: true,
          },
        ]
      : undefined,
    fields: [
      {
        input_type: "section_header",
        label: req.__("Step settings"),
      },
      {
        name: "wf_step_name",
        label: req.__("Step name"),
        type: "String",
        required: true,
        class: "validate-identifier",
        sublabel: "An identifier by which this step can be referred to.",
        validator: jsIdentifierValidator,
      },
      {
        name: "wf_initial_step",
        label: req.__("Initial step"),
        sublabel: "Is this the first step in the workflow?",
        type: "Bool",
      },
      {
        name: "wf_only_if",
        label: req.__("Only if..."),
        class: "validate-expression",
        sublabel:
          "Optional JavaScript expression based on the run context. If given, the chosen action will only be executed if evaluates to true",
        type: "String",
      },
      {
        name: "wf_next_step",
        label: req.__("Next step"),
        type: "String",
        class: "validate-expression",
        sublabel:
          "Name of next step. Can be a JavaScript expression based on the run context. Blank if final step",
      },
      {
        input_type: "section_header",
        label: req.__("Action"),
      },
      {
        name: "wf_action_name",
        label: req.__("Action"),
        type: "String",
        required: true,
        attributes: {
          options: actionsNotRequiringRow,
          explainers: actionExplainers,
        },
      },
      {
        input_type: "section_header",
        label: req.__("Action settings"),
      },
      ...actionConfigFields,
    ],
  });
  form.hidden("wf_step_id");
  form.hidden("_after_step");
  form.hidden("_after_step_for");
  if (before_step) form.values.wf_next_step = before_step;
  if (after_step == "0") form.values.wf_initial_step = true;
  else if (after_step) form.values._after_step = after_step;
  else if (after_step_for) form.values._after_step_for = after_step_for;
  if (step_id) {
    const step = await WorkflowStep.findOne({ id: step_id });
    if (!step) throw new Error("Step not found");
    form.values = {
      wf_step_id: step.id,
      wf_step_name: step.name,
      wf_initial_step: step.initial_step,
      wf_only_if: step.only_if,
      wf_action_name: step.action_name,
      wf_next_step: step.next_step,
      ...step.configuration,
    };
  }
  return form;
};

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
    const cfgFields = await getActionConfigFields(action, table, { req });

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
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { idorname } = req.params;
    let trigger;
    let id = parseInt(idorname);
    if (id) trigger = await Trigger.findOne({ id });
    else {
      trigger = await Trigger.findOne({ name: idorname });
      id = trigger.id;
    }

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
        { class: "ms-2" },
        trigger.action,
        "&nbsp;",
        trigger.when_trigger,
        table ? ` on ` + a({ href: `/table/${table.name}` }, table.name) : ""
      ) +
      a(
        { href: `/actions/edit/${id}`, class: "ms-2" },
        req.__("Edit"),
        '&nbsp;<i class="fas fa-edit"></i>'
      ) +
      a(
        { href: `/actions/testrun/${id}`, class: "ms-2" },
        req.__("Test run") + "&nbsp;&raquo;"
      );
    if (trigger.action === "Workflow") {
      const wfCfg = await getWorkflowConfig(req, id, table, trigger);
      send_events_page({
        res,
        req,
        active_sub: "Triggers",
        sub2_page: "Configure",
        page_title: req.__(`%s configuration`, trigger.name),
        headers: [
          {
            script: `/static_assets/${db.connectObj.version_tag}/mermaid.min.js`,
          },
          {
            headerTag: `<script type="module">mermaid.initialize({securityLevel: 'loose'${
              getState().getLightDarkMode(req.user) === "dark"
                ? ",theme: 'dark',"
                : ""
            }});</script>`,
          },
        ],
        contents: {
          type: "card",
          titleAjaxIndicator: true,
          title: req.__("Configure trigger %s", trigger.name),
          subtitle,
          contents: wfCfg,
        },
      });
    } else if (trigger.action === "Multi-step action") {
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
        when_trigger: trigger.when_trigger,
        req,
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
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
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
    } else if (trigger.action === "Workflow") {
      form = new Form({
        action: `/actions/configure/${id}`,
        fields: [{ name: "save_traces", label: "Save traces", type: "Bool" }],
      });
    } else {
      const cfgFields = await getActionConfigFields(action, table, {
        mode: "trigger",
        when_trigger: trigger.when_trigger,
        req,
      });
      form = new Form({
        action: `/actions/configure/${id}`,
        fields: cfgFields,
      });
    }
    form.validate(req.body || {});
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
      Trigger.emitEvent("AppChange", `Trigger ${trigger.name}`, req.user, {
        entity_type: "Trigger",
        entity_name: trigger.name,
      });
      if (req.xhr) {
        res.json({ success: "ok" });
        return;
      }
      req.flash("success", req.__("Action configuration saved"));
      res.redirect(
        req.query.on_done_redirect &&
          is_relative_url("/" + req.query.on_done_redirect)
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
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trigger = await Trigger.findOne({ id });
    Trigger.emitEvent("AppChange", `Trigger ${trigger.name}`, req.user, {
      entity_type: "Trigger",
      entity_name: trigger.name,
    });
    await trigger.delete();
    req.flash("success", req.__(`Trigger %s deleted`, trigger.name));
    let redirectTarget =
      req.query.on_done_redirect &&
      is_relative_url("/" + req.query.on_done_redirect)
        ? `/${req.query.on_done_redirect}`
        : "/actions/";
    res.redirect(redirectTarget);
  })
);

/**
 * @name get/testrun/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 */
router.get(
  "/testrun/:id",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
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
        interactive: true,
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
      if (trigger.action === "Workflow")
        res.redirect(
          runres?.__wf_run_id
            ? `/actions/run/${runres?.__wf_run_id}`
            : `/actions/runs/?trigger=${trigger.id}`
        );
      else res.redirect(`/actions/`);
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

/**
 * @name post/clone/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 * @function
 */
router.post(
  "/clone/:id",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { id } = req.params;
    const trig = await Trigger.findOne({ id });
    const newtrig = await trig.clone();
    Trigger.emitEvent("AppChange", `Trigger ${newtrig.name}`, req.user, {
      entity_type: "Trigger",
      entity_name: newtrig.name,
    });
    req.flash(
      "success",
      req.__("Trigger %s duplicated as %s", trig.name, newtrig.name)
    );
    res.redirect(`/actions`);
  })
);

/**
 * @name post/clone/:id
 * @function
 * @memberof module:routes/actions~actionsRouter
 * @function
 */
router.get(
  "/stepedit/:trigger_id{/:step_id}",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { trigger_id, step_id } = req.params;
    const { initial_step, after_step, before_step, after_step_for } = req.query;
    const trigger = await Trigger.findOne({ id: trigger_id });
    const form = await getWorkflowStepForm(
      trigger,
      req,
      step_id,
      after_step,
      before_step,
      after_step_for
    );

    if (initial_step) form.values.wf_initial_step = true;
    if (!step_id) {
      const steps = await WorkflowStep.find({ trigger_id });
      const stepNames = new Set(steps.map((s) => s.name));
      let name_ix = steps.length + 1;
      while (stepNames.has(`step${name_ix}`)) name_ix += 1;
      form.values.wf_step_name = `step${name_ix}`;
    }
    send_events_page({
      res,
      req,
      active_sub: "Triggers",
      sub2_page: "Configure",
      page_title: req.__(`%s configuration`, trigger.name),
      contents: {
        type: "card",
        titleAjaxIndicator: true,
        title: req.__(
          "Configure trigger %s",
          a({ href: `/actions/configure/${trigger.id}` }, trigger.name)
        ),
        contents: renderForm(form, req.csrfToken()),
      },
    });
  })
);

router.post(
  "/stepedit/:trigger_id",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { trigger_id } = req.params;
    const trigger = await Trigger.findOne({ id: trigger_id });
    const form = await getWorkflowStepForm(trigger, req);
    form.validate(req.body || {});
    if (form.hasErrors) {
      if (req.xhr) {
        res.json({ error: form.errorSummary });
      } else
        send_events_page({
          res,
          req,
          active_sub: "Triggers",
          sub2_page: "Configure",
          page_title: req.__(`%s configuration`, trigger.name),
          contents: {
            type: "card",
            titleAjaxIndicator: true,
            title: req.__(
              "Configure trigger %s",
              a({ href: `/actions/configure/${trigger.id}` }, trigger.name)
            ),
            contents: renderForm(form, req.csrfToken()),
          },
        });
      return;
    }
    const {
      wf_step_name,
      wf_action_name,
      wf_next_step,
      wf_initial_step,
      wf_only_if,
      wf_step_id,
      _after_step,
      _after_step_for,
      ...configuration
    } = form.values;
    Object.entries(configuration).forEach(([k, v]) => {
      if (v === null) delete configuration[k];
    });
    const step = {
      name: wf_step_name,
      action_name: wf_action_name,
      next_step: wf_next_step,
      only_if: wf_only_if,
      initial_step: wf_initial_step,
      trigger_id,
      configuration,
    };
    try {
      if (wf_step_id && wf_step_id !== "undefined") {
        const wfStep = new WorkflowStep({ id: wf_step_id, ...step });

        await wfStep.update(step);
        if (req.xhr) res.json({ success: "ok" });
        else {
          req.flash("success", req.__("Step saved"));
          res.redirect(`/actions/configure/${step.trigger_id}`);
        }
      } else {
        //insert

        const id = await WorkflowStep.create(step);
        if (req.xhr)
          res.json({ success: "ok", set_fields: { wf_step_id: id } });
        else {
          req.flash("success", req.__("Step saved"));
          res.redirect(`/actions/configure/${step.trigger_id}`);
        }
      }
      Trigger.emitEvent("AppChange", `Trigger ${trigger.name}`, req.user, {
        entity_type: "Trigger",
        entity_name: trigger.name,
      });
      if (_after_step && _after_step !== "undefined") {
        const astep = await WorkflowStep.findOne({
          id: _after_step,
          trigger_id,
        });
        if (astep) await astep.update({ next_step: step.name });
      }
      if (_after_step_for && _after_step_for !== "undefined") {
        const astep = await WorkflowStep.findOne({
          id: _after_step_for,
          trigger_id,
        });
        if (astep)
          await astep.update({
            configuration: {
              ...step.configuration,
              loop_body_initial_step: step.name,
            },
          });
      }
    } catch (e) {
      console.error(e);
      const emsg =
        e.message ===
        'duplicate key value violates unique constraint "workflow_steps_name_uniq"'
          ? `A step with the name ${wf_step_name} already exists`
          : e.message;
      if (req.xhr) res.json({ error: emsg });
      else {
        req.flash("error", emsg);
        res.redirect(`/actions/configure/${step.trigger_id}`);
      }
    }
  })
);

router.post(
  "/gen-copilot/:trigger_id",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { trigger_id } = req.params;
    const trigger = await Trigger.findOne({ id: trigger_id });
    await WorkflowStep.deleteForTrigger(trigger.id);
    const description = (req.body || {}).description;
    await Trigger.update(trigger.id, { description });
    const steps = await getState().functions.copilot_generate_workflow.run(
      description,
      trigger.id
    );
    if (steps.length) steps[0].initial_step = true;
    for (const step of steps) {
      step.trigger_id = trigger.id;
      await WorkflowStep.create(step);
    }
    Trigger.emitEvent("AppChange", `Trigger ${trigger.name}`, req.user, {
      entity_type: "Trigger",
      entity_name: trigger.name,
    });
    res.redirect(`/actions/configure/${trigger.id}`);
  })
);

router.post(
  "/delete-step/:step_id",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { step_id } = req.params;
    const step = await WorkflowStep.findOne({ id: step_id });
    await step.delete(true);
    res.json({ goto: `/actions/configure/${step.trigger_id}` });
  })
);

router.get(
  "/runs",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const trNames = {};
    const { _page, trigger } = req.query;
    for (const trig of await Trigger.find({ action: "Workflow" }))
      trNames[trig.id] = trig.name;
    const q = {};
    const selOpts = { orderBy: "started_at", orderDesc: true, limit: 20 };
    if (_page) selOpts.offset = 20 * (parseInt(_page) - 1);
    if (trigger) q.trigger_id = trigger;
    const runs = await WorkflowRun.find(q, selOpts);
    const count = await WorkflowRun.count(q);

    const wfTable = mkTable(
      [
        { label: req.__("Trigger"), key: (run) => trNames[run.trigger_id] },
        { label: req.__("Started"), key: (run) => localeDateTime(run.started_at) },
        {
          label: req.__("Updated"),
          key: (run) => localeDateTime(run.status_updated_at),
        },
        { label: req.__("Status"), key: "status" },
        {
          label: "",
          key: (run) => {
            switch (run.status) {
              case "Running":
                return run.current_step_name;
              case "Error":
                return run.error;
              case "Waiting":
                if (run.wait_info?.form || run.wait_info.output)
                  return a(
                    { href: `/actions/fill-workflow-form/${run.id}` },
                    run.wait_info.output ? "Show " : "Fill ",
                    run.current_step_name
                  );
                return run.current_step_name;
              default:
                return "";
            }
          },
        },
      ],
      runs,
      {
        onRowSelect: (row) => `location.href='/actions/run/${row.id}'`,
        pagination: {
          current_page: parseInt(_page) || 1,
          pages: Math.ceil(count / 20),
          get_page_link: (n) => `gopage(${n}, 20)`,
        },
      }
    );
    send_events_page({
      res,
      req,
      active_sub: "Workflow runs",
      page_title: req.__(`Workflow runs`),
      contents: {
        type: "card",
        titleAjaxIndicator: true,
        title: req.__("Workflow runs"),
        contents: wfTable,
      },
    });
  })
);

router.get(
  "/run/:id",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { id } = req.params;

    const run = await WorkflowRun.findOne({ id });
    const trigger = await Trigger.findOne({ id: run.trigger_id });
    const traces = await WorkflowTrace.find(
      { run_id: run.id },
      { orderBy: "id" }
    );
    const traces_accordion_items = div(
      { class: "accordion" },
      traces.map((trace, ix) =>
        div(
          { class: "accordion-item" },

          h2(
            { class: "accordion-header", id: `trhead${ix}` },
            button(
              {
                class: ["accordion-button", "collapsed"],
                type: "button",

                "data-bs-toggle": "collapse",
                "data-bs-target": `#trtab${ix}`,
                "aria-expanded": "false",
                "aria-controls": `trtab${ix}`,
              },
              `${ix + 1}: ${trace.step_name_run}`
            )
          ),
          div(
            {
              class: ["accordion-collapse", "collapse"],
              id: `trtab${ix}`,
              "aria-labelledby": `trhead${ix}`,
            },
            div(
              { class: ["accordion-body"] },
              table(
                { class: "table table-condensed w-unset" },
                tbody(
                  tr(
                    th("Started at"),
                    td(localeDateTime(trace.step_started_at))
                  ),
                  tr(th("Elapsed"), td(trace.elapsed, "s")),
                  tr(th("Run by user"), td(trace.user_id)),
                  tr(th("Status"), td(trace.status)),
                  trace.status === "Waiting"
                    ? tr(th("Waiting for"), td(JSON.stringify(trace.wait_info)))
                    : null,
                  tr(
                    th("Context"),
                    td(pre(text(JSON.stringify(trace.context, null, 2))))
                  )
                )
              )
            )
          )
        )
      )
    );

    send_events_page({
      res,
      req,
      active_sub: "Workflow runs",
      page_title: req.__(`Workflow runs`),
      sub2_page: trigger?.name,
      contents: {
        above: [
          {
            type: "card",
            titleAjaxIndicator: true,
            title: req.__("Workflow run"),
            contents:
              table(
                { class: "table table-condensed w-unset" },
                tbody(
                  tr(th("Run ID"), td(run.id)),
                  trigger &&
                    tr(
                      th("Trigger"),
                      td(
                        a(
                          { href: `/actions/configure/${trigger.id}` },
                          trigger.name
                        )
                      )
                    ),
                  tr(th("Started at"), td(localeDateTime(run.started_at))),
                  tr(th("Started by user"), td(run.started_by)),
                  tr(th("Status"), td(run.status)),
                  run.status === "Waiting"
                    ? tr(th("Waiting for"), td(JSON.stringify(run.wait_info)))
                    : null,
                  run.status === "Error"
                    ? tr(th("Error message"), td(run.error))
                    : null,
                  tr(
                    th("Context"),
                    td(pre(text(JSON.stringify(run.context, null, 2))))
                  )
                )
              ) + post_delete_btn("/actions/delete-run/" + run.id, req),
          },
          ...(traces.length
            ? [
                {
                  type: "card",
                  title: req.__("Step traces"),
                  contents: traces_accordion_items,
                },
              ]
            : []),
        ],
      },
    });
  })
);

router.post(
  "/delete-run/:id",
  isAdminOrHasConfigMinRole("min_role_edit_triggers"),
  error_catcher(async (req, res) => {
    const { id } = req.params;

    const run = await WorkflowRun.findOne({ id });
    await run.delete();
    res.redirect("/actions/runs");
  })
);

router.get(
  "/fill-workflow-form/:id",
  error_catcher(async (req, res) => {
    const { id } = req.params;

    const run = await WorkflowRun.findOne({ id });

    if (!run.user_allowed_to_fill_form(req.user)) {
      if (req.xhr) res.json({ error: "Not authorized" });
      else {
        req.flash("danger", req.__("Not authorized"));
        res.redirect("/");
      }
      return;
    }

    const trigger = await Trigger.findOne({ id: run.trigger_id });
    const step = await WorkflowStep.findOne({
      trigger_id: trigger.id,
      name: run.current_step_name,
    });
    try {
      const form = await getWorkflowStepUserForm(run, trigger, step, req);
      if (req.xhr) form.xhrSubmit = true;
      const title = run.wait_info.output ? "Workflow output" : "Fill form";
      res.sendWrap(title, renderForm(form, req.csrfToken()));
    } catch (e) {
      console.error(e);
      await run.markAsError(e, step, req.user);
      const title = req.__("Error running workflow");
      res.sendWrap(title, renderForm(e.message, req.csrfToken()));
    }
  })
);

router.post(
  "/fill-workflow-form/:id",
  error_catcher(async (req, res) => {
    const { id } = req.params;

    const run = await WorkflowRun.findOne({ id });
    if (!run.user_allowed_to_fill_form(req.user)) {
      if (req.xhr) res.json({ error: "Not authorized" });
      else {
        req.flash("danger", req.__("Not authorized"));
        res.redirect("/");
      }
      return;
    }

    const trigger = await Trigger.findOne({ id: run.trigger_id });
    const step = await WorkflowStep.findOne({
      trigger_id: trigger.id,
      name: run.current_step_name,
    });

    const form = await getWorkflowStepUserForm(run, trigger, step, req);
    form.validate(req.body || {});
    if (form.hasErrors) {
      const title = "Fill form";
      res.sendWrap(title, renderForm(form, req.csrfToken()));
    } else {
      await run.provide_form_input(form.values);
      const runres = await run.run({
        user: req.user,
        trace: trigger.configuration?.save_traces,
        interactive: true,
      });
      if (req.xhr) {
        const retDirs = await run.popReturnDirectives();

        //if (runres?.popup) retDirs.popup = runres.popup;
        res.json({ success: "ok", ...runres, ...retDirs });
      } else {
        if (run.context.goto) res.redirect(run.context.goto);
        else res.redirect("/");
      }
    }
  })
);

router.post(
  "/resume-workflow/:id",
  error_catcher(async (req, res) => {
    const { id } = req.params;

    const run = await WorkflowRun.findOne({ id });
    //TODO session if not logged in
    if (run.started_by !== req.user?.id) {
      if (req.xhr) res.json({ error: "Not authorized" });
      else {
        req.flash("danger", req.__("Not authorized"));
        res.redirect("/");
      }
      return;
    }
    const trigger = await Trigger.findOne({ id: run.trigger_id });
    const runResult = await run.run({
      user: req.user,
      interactive: true,
      trace: trigger.configuration?.save_traces,
    });
    if (req.xhr) {
      if (
        runResult &&
        typeof runResult === "object" &&
        Object.keys(runResult).length
      ) {
        res.json({ success: "ok", ...runResult });
        return;
      }
      const retDirs = await run.popReturnDirectives();
      res.json({ success: "ok", ...retDirs });
    } else {
      if (run.context.goto) res.redirect(run.context.goto);
      else res.redirect("/");
    }
  })
);

/* 

WORKFLOWS TODO

help file to explain steps, and context

workflow actions: ReadFile, WriteFile, 

EditViewForm: presets. response var can be blank
other triggers can be steps
interactive workflows for not logged in
actions can declare which variables they inject into scope

show unconnected steps
drag and drop edges

*/
