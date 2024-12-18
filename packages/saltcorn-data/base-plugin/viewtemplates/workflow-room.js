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

/**
 * @returns {object[]}
 */
const get_state_fields = () => [];
const limit = 10;

/**
 * @param {string} table_id
 * @param {string} viewname
 * @param {object} optsOne
 * @param {string} optsOne.participant_field,
 * @param {string} optsOne.msg_relation
 * @param {*} optsOne.msgsender_field
 * @param {string} optsOne.msgview
 * @param {string} optsOne.msgform
 * @param {string} optsOne.participant_maxread_field
 * @param {object} state
 * @param {object} optsTwo
 * @param {object} optsTwo.req
 * @param {object} optsTwo.res
 * @returns {Promise<div>}
 * @throws {InvalidConfiguration}
 */
const run = async (
  table_id,
  viewname,
  { workflow },
  state,
  { req, res },
  { getRowQuery, updateQuery, optionsQuery }
) => {
  const trigger = await Workflow.findOne({ name: workflow });
  const wfrun = await WorkflowRun.create({
    trigger_id: trigger.id,
    context: {},
    started_by: req.user?.id,
  });
  await wfrun.run({
    user: req.user,
    interactive: true,
    trace: trigger.configuration?.save_traces,
  });

  let items = [];
  const checkContext = async (key, alertType) => {
    if (wfrun.context[key]) {
      items.push(
        div(
          { class: `alert alert-${alertType}`, role: "alert" },
          wfrun.context[key]
        )
      );
      delete wfrun.context[key];
      await wfrun.update({ context: wfrun.context });
    }
  };
  await checkContext("notify", "info");
  await checkContext("notify_success", "success");
  await checkContext("error", "danger");

  // waiting look for form or output
  if (wfrun.wait_info.form) {
    const step = await WorkflowStep.findOne({
      trigger_id: wfrun.trigger_id,
      name: wfrun.current_step,
    });
    const form = new Form({
      action: `/view/${viewname}/submit_form`,
      submitLabel: run.wait_info.output ? req.__("OK") : req.__("Submit"),
      blurb: run.wait_info.output || step.configuration?.form_header || "",
      formStyle: run.wait_info.output || req.xhr ? "vert" : undefined,
      fields: await run.userFormFields(step),
    });
    items.push(renderForm(form, req.csrfToken()));
  }

  //look for error status

  return div(items);
};

/**
 * @param {*} table_id
 * @param {*} viewname
 * @param {object} optsOne
 * @param {string} optsOne.participant_field
 * @param {string} optsOne.participant_maxread_field
 * @param {body} body
 * @param {object} optsTwo
 * @param {object} optsTwo.req
 * @param {object} optsTwo.res
 * @returns {Promise<void>}
 */
const ack_read = async (
  table_id,
  viewname,
  { participant_field, participant_maxread_field },
  body,
  { req, res },
  { ackReadQuery }
) => {
  if (!participant_maxread_field || !participant_field)
    return {
      json: {
        success: "ok",
      },
    };

  return await ackReadQuery(participant_field, participant_maxread_field, body);
};

/**
 * @param {*} table_id
 * @param {*} viewname
 * @param {object} optsOne.
 * @param {string} optsOne.participant_field
 * @param {string} optsOne.msg_relation
 * @param {*} optsOne.msgsender_field
 * @param {string} optsOne.msgview
 * @param {*} optsOne.msgform
 * @param {*} optsOne.participant_maxread_field
 * @param {object} body
 * @param {object} optsTwo
 * @param {object} optsTwo.req
 * @param {object} optsTwo.res
 * @returns {Promise<object>}
 */
const fetch_older_msg = async (
  table_id,
  viewname,
  {
    participant_field,
    msg_relation,
    msgsender_field,
    msgview,
    msgform,
    participant_maxread_field,
  },
  body,
  { req, res },
  { fetchOlderMsgQuery }
) => {
  const partRow = await fetchOlderMsgQuery(participant_field, body);
  if (!partRow)
    return {
      json: {
        error: "Not participating",
      },
    };

  const [msgtable_name, msgkey_to_room] = msg_relation.split(".");
  const v = await View.findOne({ name: msgview });
  const vresps = await v.runMany(
    { [msgkey_to_room]: +body.room_id },
    {
      req,
      res,
      orderBy: "id",
      orderDesc: true,
      limit,
      where: { id: { lt: +body.lt_msg_id } },
    }
  );
  vresps.reverse();
  const n_retrieved = vresps.length;
  const min_read_id = Math.min.apply(
    Math,
    vresps.map((r) => r.row.id)
  );
  const msglist = vresps.map((r) => r.html).join("");
  return {
    json: {
      success: "ok",
      prepend: msglist,
      remove_fetch_older: n_retrieved < limit,
      new_fetch_older_lt: min_read_id,
    },
  };
};

/**
 * @param {*} table_id
 * @param {string} viewname
 * @param {object} optsOne
 * @param {string} optsOne.participant_field
 * @param {string} optsOne.msg_relation
 * @param {*} optsOne.msgsender_field
 * @param {string} optsOne.msgview
 * @param {string} optsOne.msgform
 * @param {string} optsOne.participant_maxread_field
 * @param {*} body
 * @param {object} optsTwo
 * @param {object} optsTwo.req
 * @param {object} optsTwo.res
 * @returns {Promise<object>}
 */
const submit_msg_ajax = async (
  table_id,
  viewname,
  {
    participant_field,
    msg_relation,
    msgsender_field,
    msgview,
    msgform,
    participant_maxread_field,
  },
  body,
  { req, res },
  { submitAjaxQuery }
) => {
  const queryResult = await submitAjaxQuery(
    msg_relation,
    participant_field,
    body,
    msgform,
    msgsender_field,
    participant_maxread_field
  );
  if (!queryResult.json.error) {
    const msgid = queryResult.json.msgid;
    const v = await View.findOne({ name: msgview });
    const myhtml = await v.run({ id: msgid.success }, { req, res });
    const newreq = { ...req, user: { ...req.user, id: 0 } };
    const theirhtml = await v.run({ id: msgid.success }, { req: newreq, res });
    const tenant = db.getTenantSchema();
    getState().emitRoom(tenant, viewname, +body.room_id, {
      append: theirhtml,
      not_for_user_id: req.user.id,
      pls_ack_msg_id: msgid.success,
    });
    return {
      json: {
        success: "ok",
        append: myhtml,
      },
    };
  } else {
    return queryResult;
  }
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
  routes: { submit_msg_ajax, ack_read, fetch_older_msg },
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
  }) => ({
    async getRowQuery(
      state_id,
      part_table_name,
      part_user_field,
      part_key_to_room
    ) {
      const parttable = Table.findOne({ name: part_table_name });
      return await parttable.getRow({
        [part_user_field]: req.user ? req.user.id : 0,
        [part_key_to_room]: +state_id,
      });
    },
    async updateQuery(
      partRow,
      part_table_name,
      max_read_id,
      part_maxread_field
    ) {
      const parttable = Table.findOne({ name: part_table_name });
      await parttable.updateRow(
        { [part_maxread_field]: max_read_id },
        partRow.id
      );
    },
    async submitAjaxQuery(
      msg_relation,
      participant_field,
      body,
      msgform,
      msgsender_field,
      participant_maxread_field
    ) {
      const table = Table.findOne({ id: table_id });

      const [msgtable_name, msgkey_to_room] = msg_relation.split(".");
      const role = req && req.user ? req.user.role_id : 100;

      let partRow, parttable;
      if (participant_field) {
        const [part_table_name, part_key_to_room, part_user_field] =
          participant_field.split(".");
        parttable = Table.findOne({ name: part_table_name });
        // check we participate

        partRow = await parttable.getRow({
          [part_user_field]: req.user ? req.user.id : 0,
          [part_key_to_room]: +body.room_id,
        });

        if (!partRow)
          return {
            json: {
              error: "Not participating",
            },
          };
      } else {
        // check we have and write access
        const canRead = role <= table.min_role_read;
        if (!canRead)
          return {
            json: {
              error: "Not participating",
            },
          };
      }
      const formview = await View.findOne({ name: msgform });
      if (!formview)
        throw new InvalidConfiguration("Message form view does not exist");
      const { columns, layout, fixed } = formview.configuration;
      const msgtable = Table.findOne({ name: msgtable_name });

      const form = await getForm(
        msgtable,
        viewname,
        columns,
        layout,
        null,
        req
      );
      form.validate(req.body);
      if (!form.hasErrors) {
        const use_fixed = await fill_presets(msgtable, req, fixed);
        const row = {
          ...form.values,
          ...use_fixed,
          [msgkey_to_room]: body.room_id,
          [msgsender_field]: req.user.id,
        };
        const msgid = await msgtable.tryInsertRow(row, req.user);
        if (participant_maxread_field && partRow) {
          const [part_table_name1, part_key_to_room1, part_maxread_field] =
            participant_maxread_field.split(".");
          await parttable.updateRow(
            { [part_maxread_field]: msgid.success },
            partRow.id
          );
        }
        return {
          json: { msgid },
        };
      } else {
        return {
          json: {
            error: form.errors,
          },
        };
      }
    },
    async ackReadQuery(participant_field, participant_maxread_field, body) {
      const [part_table_name, part_key_to_room, part_user_field] =
        participant_field.split(".");
      const [part_table_name1, part_key_to_room1, part_maxread_field] =
        participant_maxread_field.split(".");

      const parttable = Table.findOne({ name: part_table_name });
      // check we participate

      const partRow = await parttable.getRow({
        [part_user_field]: req.user ? req.user.id : 0,
        [part_key_to_room]: +body.room_id,
      });

      if (!partRow)
        return {
          json: {
            error: "Not participating",
          },
        };

      await parttable.updateRow({ [part_maxread_field]: body.id }, partRow.id);
      return {
        json: {
          success: "ok",
        },
      };
    },
    async fetchOlderMsgQuery(participant_field, body) {
      const [part_table_name, part_key_to_room, part_user_field] =
        participant_field.split(".");
      const parttable = Table.findOne({ name: part_table_name });
      // check we participate
      return await parttable.getRow({
        [part_user_field]: req.user ? req.user.id : 0,
        [part_key_to_room]: +body.room_id,
      });
    },
    async optionsQuery(reftable_name, type, attributes, where) {
      const rows = await db.select(
        reftable_name,
        type === "File" ? attributes.select_file_where : where
      );
      return rows;
    },
  }),
  connectedObjects: async (configuration) => {
    return extractFromLayout(configuration.layout);
  },
};
/*todo:

find_or_create_dm_room -dms only 

*/
