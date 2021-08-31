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
const { InvalidConfiguration } = require("../../utils");
const { getState } = require("../../db/state");
const db = require("../../db");
const { getForm, fill_presets } = require("./viewable_fields");

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
                required: true,
                attributes: {
                  options: participant_field_options,
                },
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = () => [
  {
    name: "id",
    type: "Integer",
    required: true,
    primary_key: true,
  },
];

const run = async (
  table_id,
  viewname,
  { participant_field, msg_relation, msgsender_field, msgview, msgform },
  state,
  { req, res }
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  readState(state, fields);
  if (!state.id) return "Need room id";

  const appState = getState();
  const locale = req.getLocale();
  const __ = (s) => appState.i18n.__({ phrase: s, locale }) || s;
  if (!participant_field || !msgview || !msgform || !msgsender_field)
    throw new InvalidConfiguration(
      `View ${viewname} incorrectly configured: must supply Message views, Message sender and Participant fields`
    );

  const [msgtable_name, msgkey_to_room] = msg_relation.split(".");
  const [
    part_table_name,
    part_key_to_room,
    part_user_field,
  ] = participant_field.split(".");

  // check we participate
  const parttable = Table.findOne({ name: part_table_name });
  const parttable_fields = await parttable.getFields();
  const parttable_userfield_field = parttable_fields.find(
    (f) => f.name === part_user_field
  );
  const userlabel =
    parttable_userfield_field.attributes.summary_field || "email";
  const participants = await parttable.getJoinedRows({
    where: {
      [part_key_to_room]: state.id,
    },
    joinFields: {
      [userlabel]: { ref: part_user_field, target: userlabel },
    },
  });
  const partRow = participants.find((p) => p[part_user_field] === +req.user.id);
  if (!partRow) return "You are not a participant in this room";

  const v = await View.findOne({ name: msgview });
  const vresps = await v.runMany(
    { [msgkey_to_room]: state.id },
    { req, res, orderBy: "id" }
  );

  const msglist = vresps.map((r) => r.html).join("");
  const formview = await View.findOne({ name: msgform });
  if (!formview)
    throw new InvalidConfiguration("Message form view does not exist");
  const { columns, layout } = formview.configuration;
  const msgtable = Table.findOne({ name: msgtable_name });

  const form = await getForm(msgtable, viewname, columns, layout, null, req);

  form.class = `room-${state.id}`;
  form.hidden("room_id");
  form.values = { room_id: state.id };
  return div(
    div({ class: `msglist-${state.id}` }, msglist),
    renderForm(form, req.csrfToken()),
    script({
      src: `/static_assets/${db.connectObj.version_tag}/socket.io.min.js`,
    }) + script(domReady(`init_room("${viewname}", ${state.id})`))
  );
};

const submit_msg_ajax = async (
  table_id,
  viewname,
  { participant_field, msg_relation, msgsender_field, msgview, msgform },
  body,
  { req, res }
) => {
  const [msgtable_name, msgkey_to_room] = msg_relation.split(".");
  const [
    part_table_name,
    part_key_to_room,
    part_user_field,
  ] = participant_field.split(".");
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

  const formview = await View.findOne({ name: msgform });
  if (!formview)
    throw new InvalidConfiguration("Message form view does not exist");
  const { columns, layout, fixed } = formview.configuration;
  const msgtable = Table.findOne({ name: msgtable_name });

  const form = await getForm(msgtable, viewname, columns, layout, null, req);
  form.validate(req.body);
  if (!form.hasErrors) {
    const use_fixed = await fill_presets(msgtable, req, fixed);
    const row = {
      ...form.values,
      ...use_fixed,
      [msgkey_to_room]: body.room_id,
      [msgsender_field]: req.user.id,
    };
    const msgid = await msgtable.tryInsertRow(row, req.user.id);

    const v = await View.findOne({ name: msgview });
    const html = await v.run({ id: msgid.success }, { req, res });
    getState().emitRoom(viewname, +body.room_id, html);
    return {
      json: {
        success: "ok",
      },
    };
  } else {
    return {
      json: {
        error: form.errors,
      },
    };
  }
};
module.exports = {
  name: "Room",
  description: "Real-time space for chat",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: false,
  routes: { submit_msg_ajax },
  noAutoTest: true,
  authorize_join: async ({ participant_field }, room_id, user) => {
    if (!user) return false;
    const [
      part_table_name,
      part_key_to_room,
      part_user_field,
    ] = participant_field.split(".");

    // TODO check we participate
    const parttable = Table.findOne({ name: part_table_name });
    const partRow = await parttable.getRow({
      [part_user_field]: user.id,
      [part_key_to_room]: room_id,
    });
    return !!partRow;
  },
  getStringsForI18n({ create_view_label }) {
    if (create_view_label) return [create_view_label];
    else return [];
  },
};
/*todo:

find_or_create_dm_room
insert row emits to room
select order fields 

*/
