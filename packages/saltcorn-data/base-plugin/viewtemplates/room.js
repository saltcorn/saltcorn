/**
 * @category saltcorn-data
 * @module base-plugin/viewtemplates/room
 * @subcategory base-plugin
 */
const Field = require("../../models/field");
const Table = require("../../models/table");
const Form = require("../../models/form");
const View = require("../../models/view");
const Workflow = require("../../models/workflow");
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
const { InvalidConfiguration, isNode } = require("../../utils");
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
        name: req.__("Views"),
        form: async (context) => {
          /*
            we need:
                - message string
                - message show view?
                - message sender field
                - participant field: key to user in table with fkey to this
            */

          const roomtable = await Table.findOne(context.table_id);
          const { child_relations } = await roomtable.get_child_relations();
          //const msg_table_options = child_relations.map(cr=>cr.table.name)
          const participant_field_options = [];
          const msg_relation_options = [];
          const msgsender_field_options = {};
          const msgview_options = {};
          const msgform_options = {};
          const participant_max_read_options = [];
          const msg_own_options = [];

          for (const { table, key_field } of child_relations) {
            const fields = await table.getFields();
            for (const f of fields) {
              if (f.reftable_name === "users") {
                participant_field_options.push(
                  `${table.name}.${key_field.name}.${f.name}`
                );

                msg_relation_options.push(`${table.name}.${key_field.name}`);

                msgsender_field_options[`${table.name}.${key_field.name}`] = [
                  ...(msgsender_field_options[
                    `${table.name}.${key_field.name}`
                  ] || []),
                  f.name,
                ];

                const views = await View.find_possible_links_to_table(table);
                msgview_options[`${table.name}.${key_field.name}`] = views.map(
                  (v) => v.name
                );
                msgform_options[`${table.name}.${key_field.name}`] = views.map(
                  (v) => v.name
                );
              } else if (f.reftable_name) {
                participant_max_read_options.push(
                  `${table.name}.${key_field.name}.${f.name}`
                );
              }
            }
          }
          return new Form({
            fields: [
              {
                name: "msg_relation",
                label: req.__("Message relation"),
                type: "String",
                sublabel: req.__(
                  "The relationship to the table of individual messages"
                ),
                required: true,
                attributes: {
                  options: msg_relation_options,
                },
              },
              {
                name: "msgsender_field",
                label: req.__("Message sender field"),
                type: "String",
                sublabel: req.__(
                  "The field for the sender user id on the table for messages"
                ),
                required: true,
                attributes: {
                  calcOptions: ["msg_relation", msgsender_field_options],
                },
              },
              {
                name: "msgview",
                label: req.__("Message show view"),
                type: "String",
                sublabel: req.__("The view to show an individual message"),
                required: true,
                attributes: {
                  calcOptions: ["msg_relation", msgview_options],
                },
              },
              {
                name: "msgform",
                label: req.__("New message form view"),
                type: "String",
                sublabel: req.__("The view to enter a new message"),
                required: true,
                attributes: {
                  calcOptions: ["msg_relation", msgform_options],
                },
              },
              {
                name: "participant_field",
                label: req.__("Participant field"),
                type: "String",
                sublabel: req.__("The field for the participant user id"),
                required: false,
                attributes: {
                  options: participant_field_options,
                },
              },
              {
                name: "participant_maxread_field",
                label: req.__("Participant max read id field"),
                type: "String",
                sublabel: req.__(
                  "The field for the participant's last read message, of type Key to message table"
                ),
                attributes: {
                  options: participant_max_read_options,
                },
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
const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true,
    primary_key: true,
  },
];
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
  {
    participant_field,
    msg_relation,
    msgsender_field,
    msgview,
    msgform,
    participant_maxread_field,
  },
  state,
  { req, res },
  { getRowQuery, updateQuery, optionsQuery }
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  readState(state, fields);
  if (!state.id) return "Need room id";
  const appState = getState();
  const locale = req.getLocale();
  const role = req && req.user ? req.user.role_id : 10;
  const __ = (s) => appState.i18n.__({ phrase: s, locale }) || s;
  if (!msgview || !msgform || !msgsender_field || !msg_relation)
    throw new InvalidConfiguration(
      `View ${viewname} incorrectly configured: must supply Message views, Message sender and Participant fields`
    );

  const [msgtable_name, msgkey_to_room] = msg_relation.split(".");
  let partRow, part_table_name, canWrite;
  if (participant_field) {
    const [part_table_name1, part_key_to_room, part_user_field] =
      participant_field.split(".");
    part_table_name = part_table_name1;
    // check we participate
    partRow = await getRowQuery(
      state.id,
      part_table_name,
      part_user_field,
      part_key_to_room
    );
    if (!partRow) return "You are not a participant in this room";
    canWrite = true;
  } else {
    // check we have and write access
    const canRead = role <= table.min_role_read;
    if (!canRead) return "You do not have access to this room";

    canWrite = role <= table.min_role_write;
  }
  const v = await View.findOne({ name: msgview });
  const vresps = await v.runMany(
    { [msgkey_to_room]: state.id },
    { req, res, orderBy: "id", orderDesc: true, limit }
  );
  vresps.reverse();
  const n_retrieved = vresps.length;

  const msglist = vresps.map((r) => r.html).join("");
  const formview = await View.findOne({ name: msgform });
  if (!formview)
    throw new InvalidConfiguration("Message form view does not exist");
  const { columns, layout } = formview.configuration;
  const msgtable = Table.findOne({ name: msgtable_name });
  const min_read_id = Math.min.apply(
    Math,
    vresps.map((r) => r.row.id)
  );
  if (participant_maxread_field) {
    const [part_table_name1, part_key_to_room1, part_maxread_field] =
      participant_maxread_field.split(".");
    const max_read_id = Math.max.apply(
      Math,
      vresps.map((r) => r.row.id)
    );
    if (vresps.length > 0 && partRow && part_table_name)
      await updateQuery(
        partRow,
        part_table_name,
        max_read_id,
        part_maxread_field
      );
  }
  const form = await getForm(msgtable, viewname, columns, layout, null, req);

  form.class = `room-${state.id}`;
  form.hidden("room_id");
  form.values = { room_id: state.id };
  await form.fill_fkey_options(false, optionsQuery);
  return div(
    n_retrieved === limit &&
      button(
        {
          class: "btn btn-outline-secondary mb-1 fetch_older",
          onclick: `room_older('${viewname}',${state.id},this)`,
          "data-lt-msg-id": min_read_id,
        },
        req.__("Show older messages")
      ),
    div({ class: `msglist-${state.id}`, "data-user-id": req.user.id }, msglist),
    canWrite && renderForm(form, req.csrfToken()),
    script({
      src: `/static_assets/${db.connectObj.version_tag}/socket.io.min.js`,
    }) + script(domReady(`init_room("${viewname}", ${state.id})`))
  );
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
const virtual_triggers = (
  table_id,
  viewname,
  {
    participant_field,
    msg_relation,
    msgsender_field,
    msgview,
    msgform,
    participant_maxread_field,
  }
) => {
  if (!msg_relation) return [];
  const [msgtable_name, msgkey_to_room] = msg_relation.split(".");
  const msgtable = Table.findOne({ name: msgtable_name });
  if (!msgsender_field) return [];

  return [
    {
      when_trigger: "Insert",
      table_id: msgtable.id,
      run: async (row) => {
        if (row[msgsender_field]) return; // TODO how else to avoid double emit
        const v = await View.findOne({ name: msgview });

        const html = await v.run(
          { id: row.id },
          {
            req: { getLocale: () => "en", user: { id: 0 }, __: (s) => s },
            res: {},
          }
        );
        const tenant = db.getTenantSchema();
        getState().emitRoom(tenant, viewname, row[msgkey_to_room], {
          append: html,
          pls_ack_msg_id: row.id,
        });
      },
    },
  ];
};
module.exports = {
  /** @type {string} */
  name: "Room",
  /** @type {string} */
  description: "Real-time space for chat",
  configuration_workflow,
  run,
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
  authorize_join: async (
    { table_id, configuration: { participant_field } },
    room_id,
    user
  ) => {
    // TODO ch authorize_join query
    if (!user) return false;
    if (!participant_field) {
      const table = await Table.findOne({ id: table_id });
      return user.role_id <= table.min_role_read;
    } else {
      const [part_table_name, part_key_to_room, part_user_field] =
        participant_field.split(".");

      // TODO check we participate
      const parttable = Table.findOne({ name: part_table_name });
      const partRow = await parttable.getRow({
        [part_user_field]: user.id,
        [part_key_to_room]: room_id,
      });
      return !!partRow;
    }
  },
  virtual_triggers,
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
      const table = await Table.findOne({ id: table_id });

      const [msgtable_name, msgkey_to_room] = msg_relation.split(".");
      const role = req && req.user ? req.user.role_id : 10;

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
