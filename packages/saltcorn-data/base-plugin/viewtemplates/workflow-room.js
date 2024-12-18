/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/room
 * @subcategory base-plugin
 */
const Field = require("../../models/field");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Trigger = require("../../models/trigger");
const Workflow = require("../../models/workflow");
const WorkflowRun = require("../../models/workflow_run");
const WorkflowStep = require("../../models/workflow_step");
const {
  text,
  div,
  h4,
  hr,
  button,
  form,
  input,
  i,
  script,
  domReady,
} = require("@saltcorn/markup/tags");
const { pagination } = require("@saltcorn/markup/helpers");
const { renderForm, tabs, link } = require("@saltcorn/markup");
const { mkTable } = require("@saltcorn/markup");
const {
  link_view,
  stateToQueryString,
  stateFieldsToWhere,
  stateFieldsToQuery,
  readState,
} = require("../../plugin-helper");
const { InvalidConfiguration } = require("../../utils");
const { getState } = require("../../db/state");
const db = require("../../db");
const { getForm, fill_presets } = require("./viewable_fields");
const { extractFromLayout } = require("../../diagram/node_extract_utils");

/**
 *
 * @param {object} req
 * @returns {Workflow}
 */
const configuration_workflow = (req) =>
  new Workflow({
    steps: [
      {
        name: req.__("Workflow"),
        form: async (context) => {
          const wfs = await Trigger.find({ action: "Workflow" });
          return new Form({
            fields: [
              {
                name: "workflow",
                label: "Workflow",
                type: "String",
                required: true,
                attributes: { options: wfs.map((wf) => wf.name) },
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = () => [];

const getHtmlFromRun = async ({ run, req, viewname }) => {
  let items = [];
  const checkContext = async (key, alertType) => {
    if (run.context[key]) {
      items.push(
        div(
          { class: `alert alert-${alertType}`, role: "alert" },
          run.context[key]
        )
      );
      delete run.context[key];
      await run.update({ context: run.context });
    }
  };
  await checkContext("notify", "info");
  await checkContext("notify_success", "success");
  await checkContext("error", "danger");

  // waiting look for form or output
  if (run.wait_info.output) {
    items.push(div(run.wait_info.output));
    items.push(
      script(
        domReady(
          `ajax_post_json("/view/${viewname}/submit_form", {run_id: ${run.id}});`
        )
      )
    );
  }
  if (run.wait_info.form) {
    const step = await WorkflowStep.findOne({
      trigger_id: run.trigger_id,
      name: run.current_step,
    });
    const form = await getWorkflowStepUserForm({ step, run, viewname, req });
    items.push(renderForm(form, req.csrfToken()));
  }
  return items;
};

const getWorkflowStepUserForm = async ({ step, run, viewname, req }) => {
  const fields = await run.userFormFields(step);

  const form = new Form({
    action: `/view/${viewname}/submit_form`,
    xhrSubmit: true,
    submitLabel: run.wait_info.output ? req.__("OK") : req.__("Submit"),
    blurb: run.wait_info.output || step.configuration?.form_header || "",
    formStyle: "vert",
    fields,
  });
  form.hidden("run_id");

  form.values.run_id = run.id;
  return form;
};

const run = async (
  table_id,
  viewname,
  { workflow },
  state,
  { req, res },
  { getRowQuery, updateQuery, optionsQuery }
) => {
  const trigger = await Trigger.findOne({ name: workflow });
  let run;
  if (state.id) {
    run = await WorkflowRun.findOne({ id: state.id });
    if (run.started_by != req.user?.id && req.user?.role_id != 1)
      return "Not authorized";
  } else
    run = await WorkflowRun.create({
      trigger_id: trigger.id,
      context: {},
      started_by: req.user?.id,
    });
  await run.run({
    user: req.user,
    interactive: true,
    trace: trigger.configuration?.save_traces,
  });
  const items = await getHtmlFromRun({ run, req, viewname });
  //look for error status

  return div({ id: `wfroom-${run.id}` }, items);
};

const submit_form = async (table_id, viewname, { workflow }, body, { req }) => {
  const run = await WorkflowRun.findOne({ id: body.run_id });
  const trigger = await Trigger.findOne({ id: run.trigger_id });
  const step = await WorkflowStep.findOne({
    trigger_id: trigger.id,
    name: run.current_step,
  });
  const form = await getWorkflowStepUserForm({ step, run, viewname, req });

  form.validate(req.body);
  await run.provide_form_input(form.values);
  await run.run({
    user: req.user,
    interactive: true,
    trace: trigger.configuration?.save_traces,
  });
  const items = await getHtmlFromRun({ run, req, viewname });
  return {
    json: {
      success: "ok",
      eval_js: `$('#wfroom-${run.id}').append(${JSON.stringify(
        items.join("")
      )})`,
    },
  };
};

/**
 * @param {*} table_id
 * @param {string} viewname
 * @param {object} opts
 * @param {*} opts.participant_field
 * @param {string} opts.msg_relation,
 * @param {string} opts.msgsender_field,
 * @param {string} opts.msgview,
 * @param {*} opts.msgform,
 * @param {*} opts.participant_maxread_field,
 * @returns {object[]}
 */

module.exports = {
  /** @type {string} */
  name: "WorkflowRoom",
  /** @type {string} */
  description: "Chatbot interface for workflows",
  configuration_workflow,
  run,
  tableless: true,
  get_state_fields,
  /** @type {boolean} */
  display_state_form: false,
  routes: { submit_form },
  /** @type {boolean} */
  noAutoTest: true,
  /**
   * @param {object} opts
   * @param {object} opts.participant_field
   * @param {string} room_id
   * @param {object} user
   * @returns {Promise<object>}
   */

  /** @returns {object[]} */
  getStringsForI18n() {
    return [];
  },
  queries: ({
    table_id,
    viewname,
    configuration: { columns, default_state },
    req,
  }) => ({}),
  connectedObjects: async (configuration) => {
    return extractFromLayout(configuration.layout);
  },
};
/*todo:

-show a previous run
-previous runs list
-styling

*/
