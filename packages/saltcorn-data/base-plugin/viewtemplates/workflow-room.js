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
  a,
  h4,
  hr,
  button,
  form,
  input,
  pre,
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
const WorkflowTrace = require("../../models/workflow_trace");
const { localeDateTime } = require("@saltcorn/markup/index");
const MarkdownIt = require("markdown-it"),
  md = new MarkdownIt();

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
                sublabel:
                  req.__("The workflow the user will be interacting with.") +
                  " " +
                  a(
                    {
                      "data-dyn-href": `\`/actions/configure/\${workflow}\``,
                      target: "_blank",
                    },
                    req.__("Configure")
                  ),
              },
              {
                name: "prev_runs",
                label: "Show previous runs",
                type: "Bool",
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = () => [];

const getHtmlFromTraces = async ({ run, req, viewname, traces }) => {
  let items = [];
  for (let ix = 0; ix < traces.length - 1; ix++) {
    const trace = traces[ix];
    const fakeRun = new WorkflowRun(run);
    fakeRun.wait_info = trace.wait_info;
    fakeRun.context = trace.context;
    if (trace.status === "Waiting" && trace.wait_info.form) {
      fakeRun.context = traces[ix + 1] ? traces[ix + 1].context : run.context;
    }
    fakeRun.current_step = [trace.step_name_run];
    fakeRun.status = trace.status;
    fakeRun.error = trace.error;

    const myItems = await getHtmlFromRun({
      req,
      viewname,
      run: fakeRun,
      noInteract: true,
    });
    items.push(...myItems);
  }
  return items;
};
const getHtmlFromRun = async ({ run, req, viewname, noInteract }) => {
  let items = [];
  let submit_ajax = false;
  const checkContext = async (key, alertType) => {
    if (run.context[key]) {
      items.push(
        div(
          { class: `alert alert-${alertType}`, role: "alert" },
          run.context[key]
        )
      );
      if (!noInteract) {
        delete run.context[key];
        await run.update({ context: run.context });
        submit_ajax = true;
      }
    }
  };

  await checkContext("notify", "info");
  await checkContext("notify_success", "success");
  await checkContext("error", "danger");

  if (run.status === "Error") {
    items.push(div({ class: `alert alert-danger`, role: "alert" }, run.error));
  }
  // waiting look for form or output
  if (run.wait_info?.output) {
    let out = run.wait_info.output;
    if (run.wait_info.markdown) out = md.render(out);
    items.push(div(out));
    if (!noInteract) submit_ajax = true;
  }
  if (run.wait_info?.form) {
    const step = await WorkflowStep.findOne({
      trigger_id: run.trigger_id,
      name: run.current_step_name,
    });
    const form = await getWorkflowStepUserForm({ step, run, viewname, req });
    if (noInteract) {
      form.noSubmitButton = true;
      form.fields = form.fields.map((f) => {
        const nf = new Field(f);
        nf.disabled = true;
        form.values[f.name] = run.context[f.name];
        return nf;
      });
    }
    items.push(renderForm(form, req.csrfToken()));
  } else if (submit_ajax && !noInteract) {
    items.push(
      script(
        domReady(
          `ajax_post_json("/view/${viewname}/submit_form", {run_id: ${run.id}});`
        )
      )
    );
  }
  return items;
};

const getWorkflowStepUserForm = async ({ step, run, viewname, req }) => {
  if (step.action_name === "EditViewForm") {
    const view = View.findOne({ name: step.configuration.edit_view });
    const table = Table.findOne({ id: view.table_id });
    const form = await getForm(
      table,
      view.name,
      view.configuration.columns,
      view.configuration.layout,
      null,
      req
    );
    form.action = `/view/${viewname}/submit_form`;
    form.onSubmit = `$(this).closest('form').find('button').hide();$('#wfroom-spin-${run.id}').show();setTimeout(()=>$(this).closest('form').find('input,select,textarea').prop('disabled', true),100);`;
    if (run.context[step.configuration.response_variable])
      Object.assign(
        form.values,
        run.context[step.configuration.response_variable]
      );
    form.hidden("run_id");
    form.xhrSubmit = true;
    await form.fill_fkey_options(false, undefined, req?.user);
    form.values.run_id = run.id;
    return form;
  }

  const form = new Form({
    action: `/view/${viewname}/submit_form`,
    xhrSubmit: true,
    onSubmit: `$(this).closest('form').find('button').hide();$('#wfroom-spin-${run.id}').show();setTimeout(()=>$(this).closest('form').find('input,select,textarea').prop('disabled', true),100);`,
    submitLabel: run.wait_info.output ? req.__("OK") : req.__("Submit"),
    blurb: run.wait_info.output || step.configuration?.form_header || "",
    formStyle: "vert",
    ...(await run.userFormFields(step, req?.user)),
  });
  form.hidden("run_id");

  form.values.run_id = run.id;
  return form;
};

const run = async (
  table_id,
  viewname,
  { workflow, prev_runs },
  state,
  { req, res, isPreview },
  { getRowQuery, updateQuery, optionsQuery }
) => {
  const trigger = await Trigger.findOne({ name: workflow });
  let run;
  let prevItems = [];
  if (state.id || isPreview) {
    run = isPreview
      ? await WorkflowRun.findOne(
          { trigger_id: trigger.id },
          { limit: 1, orderBy: "id", orderDesc: true }
        )
      : await WorkflowRun.findOne({ id: state.id });
    if (run) {
      if (run.started_by != req.user?.id && req.user?.role_id != 1)
        return "Not authorized";
      if (trigger.configuration.save_traces) {
        const traces = await WorkflowTrace.find(
          { run_id: run.id },
          { orderBy: "step_started_at" }
        );
        prevItems = await getHtmlFromTraces({ run, req, viewname, traces });
      }
    } else {
      if (!isPreview) return "Run not found";
      else return "No runs yet";
    }
  } else
    run = await WorkflowRun.create({
      trigger_id: trigger.id,
      context: {},
      started_by: req.user?.id,
    });
  await run.run({
    user: req.user,
    noNotifications: true,
    trace: trigger.configuration?.save_traces,
  });
  const items = await getHtmlFromRun({ run, req, viewname });
  //look for error status
  if (prev_runs) {
    const locale = req.getLocale();
    const runs = await WorkflowRun.find(
      { trigger_id: trigger.id },
      { limit: 10, orderBy: "started_at", orderDesc: true }
    );
    return div(
      { class: "row" },
      div(
        { class: "col-2 col-md-3 col-sm-4" },
        req.__("Previous runs"),
        runs.map((run1) =>
          div(
            { class: "d-flex prevwfroomrun" },
            a(
              {
                href: `javascript:void(0)`,
                onclick: `reload_embedded_view('${viewname}', 'id=${run1.id}')`,
                class: ["text-nowrap", run1.id == run.id && "fw-bold"],
              },
              localeDateTime(run1.started_at, {}, locale)
            ),
            i({
              class: "far fa-trash-alt ms-2",
              onclick: `delprevwfroomrun('${viewname}', event, ${run1.id})`,
            })
          )
        )
      ),
      div(
        { class: "col-10 col-md-9 col-sm-8" },
        div({ id: `wfroom-${run.id}` }, prevItems, items),
        div(
          { id: `wfroom-spin-${run.id}`, style: { display: "none" } },
          i({ class: "fas fa-spinner fa-spin" })
        )
      )
    );
  } else return div(div({ id: `wfroom-${run.id}` }, prevItems, items));
};

const submit_form = async (table_id, viewname, { workflow }, body, { req }) => {
  const run = await WorkflowRun.findOne({ id: body.run_id });
  const trigger = await Trigger.findOne({ id: run.trigger_id });
  const step = await WorkflowStep.findOne({
    trigger_id: trigger.id,
    name: run.current_step_name,
  });
  const form = await getWorkflowStepUserForm({ step, run, viewname, req });

  form.validate(req.body || {});
  await run.provide_form_input(form.values);
  await run.run({
    user: req.user,
    noNotifications: true,
    trace: trigger.configuration?.save_traces,
  });
  const items = await getHtmlFromRun({ run, req, viewname });
  return {
    json: {
      success: "ok",
      eval_js: `$('#wfroom-${run.id}').append(${JSON.stringify(
        items.join("")
      )});$('#wfroom-spin-${run.id}')[0]?.scrollIntoView();$('#wfroom-spin-${
        run.id
      }').hide()`,
    },
  };
};

const delprevrun = async (table_id, viewname, config, body, { req, res }) => {
  const { run_id } = body;
  let run = await WorkflowRun.findOne({
    id: +run_id,
  });
  if (run && (req.user?.role_id === 1 || run.started_by === req.user?.id))
    await run.delete();

  return;
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
  routes: { submit_form, delprevrun },
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
