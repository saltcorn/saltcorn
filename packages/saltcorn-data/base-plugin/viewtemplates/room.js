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
const {} = require("./viewable_fields");
const pluralize = require("pluralize");
const {
  link_view,
  stateToQueryString,
  stateFieldsToWhere,
  stateFieldsToQuery,
  readState,
} = require("../../plugin-helper");
const { InvalidConfiguration } = require("../../utils");
const { getState } = require("../../db/state");

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
          const msgstring_field_options = [];
          const msgsender_field_options = [];
          for (const { table, key_field } of child_relations) {
            const fields = await table.getFields();
            fields.forEach((f) => {
              if (f.reftable_name === "users") {
                participant_field_options.push(
                  `${table.name}.${key_field.name}.${f.name}`
                );
                msgsender_field_options.push(
                  `${table.name}.${key_field.name}.${f.name}`
                );
              }
              if (f.type && f.type.name === "String") {
                msgstring_field_options.push(
                  `${table.name}.${key_field.name}.${f.name}`
                );
              }
            });
          }
          return new Form({
            fields: [
              {
                name: "msgstring_field",
                label: req.__("Message string field"),
                type: "String",
                sublabel: req.__(
                  "The field for the message content on the table for messages"
                ),
                required: true,
                attributes: {
                  options: msgstring_field_options,
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
                  options: msgsender_field_options,
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

const get_state_fields = async (table_id, viewname, { show_view }) => {
  const table_fields = await Field.find({ table_id });
  return table_fields
    .filter((f) => !f.primary_key)
    .map((f) => {
      const sf = new Field(f);
      sf.required = false;
      return sf;
    });
};
const run = async (
  table_id,
  viewname,
  { participant_field, msgstring_field, msgsender_field },
  state,
  extraArgs
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  readState(state, fields);
  if (!state.id) return "Need room id";

  const appState = getState();
  const locale = extraArgs.req.getLocale();
  const __ = (s) => appState.i18n.__({ phrase: s, locale }) || s;
  if (!participant_field || !msgstring_field || !msgsender_field)
    throw new InvalidConfiguration(
      `View ${viewname} incorrectly configured: must supply Message string, Message sender and Participant fields`
    );
  // 1. show existing messages
  const [msgtable_name, msgkey_to_room, msgstring] = msgstring_field.split(".");
  const [
    part_table_name,
    part_key_to_room,
    part_user_field,
  ] = participant_field.split(".");
  const msgtable = Table.findOne({ name: msgtable_name });
  const msgs = await msgtable.getRows({ [msgkey_to_room]: state.id });
  // 2. insert message form
  return div(
    div(
      { class: "msglist" },
      msgs.map((msg) => div(msg[msgstring]))
    ),
    form(
      { class: "room", action: "" },
      input({ autocomplete: "off", name: "message" }),
      input({ type: "hidden", name: "room_id", value: state.id }),
      button(i({ class: "far fa-paper-plane" }))
    ),
    script(domReady(`init_room("${viewname}")`))
  );
};
const submit_msg_ajax = async (
  table_id,
  viewname,
  { participant_field, msgstring_field, msgsender_field },
  body,
  { req, res }
) => {
  const [msgtable_name, msgkey_to_room, msgstring] = msgstring_field.split(".");
  const [msgtable_name1, msgkey_to_room1, msgsender] = msgsender_field.split(
    "."
  );
  const msgtable = Table.findOne({ name: msgtable_name });
  const row = {
    [msgstring]: body.message,
    [msgkey_to_room]: body.room_id,
    [msgsender]: req.user.id,
  };
  console.log(row);
  await msgtable.tryInsertRow(row, req.user.id);
  return { json: { success: "ok" } };
};
module.exports = {
  name: "Room",
  description: "Real-time space for chat",
  configuration_workflow,
  run,
  get_state_fields,
  display_state_form: false,
  routes: { submit_msg_ajax },

  getStringsForI18n({ create_view_label }) {
    if (create_view_label) return [create_view_label];
    else return [];
  },
};
