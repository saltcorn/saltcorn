/**
 * Action description
 *
 */

const fetch = require("node-fetch");
const vm = require("vm");
const Table = require("../models/table");
const View = require("../models/view");
const { getState } = require("../db/state");
const User = require("../models/user");
const Trigger = require("../models/trigger");
const {
  getMailTransport,
  transformBootstrapEmail,
} = require("../models/email");
const { mockReqRes } = require("../tests/mocks");
const { get_async_expression_function } = require("../models/expression");
const { div, code } = require("@saltcorn/markup/tags");
const { sleep } = require("../utils");
//action use cases: field modify, like/rate (insert join), notify, send row to webhook
// todo add translation

const run_code = async ({
  row,
  table,
  channel,
  configuration: { code },
  user,
  ...rest
}) => {
  const Actions = {};
  Object.entries(getState().actions).forEach(([k, v]) => {
    Actions[k] = (args = {}) => {
      v.run({ row, table, user, configuration: args, ...rest, ...args });
    };
  });
  const emitEvent = (eventType, channel, payload) =>
    Trigger.emitEvent(eventType, channel, user, payload);
  const f = vm.runInNewContext(`async () => {${code}}`, {
    Table,
    table,
    row,
    user,
    console,
    Actions,
    emitEvent,
    sleep,
    channel: table ? table.name : channel,
    ...(row || {}),
    ...getState().function_context,
    ...rest,
  });
  return await f();
};

module.exports = {
  blocks: {
    configFields: [
      {
        name: "workspace",
        input_type: "hidden",
      },
      {
        name: "code",
        input_type: "hidden",
      },
    ],
    run: run_code,
  },
  emit_event: {
    configFields: () => [
      {
        name: "eventType",
        label: "Event type",
        required: true,
        input_type: "select",
        options: Trigger.when_options,
      },
      {
        name: "channel",
        label: "Channel",
        type: "String",
        fieldview: "textarea",
      },
      {
        name: "payload",
        label: "Payload JSON",
        sublabel: "Leave blank to use row from table",
        type: "String",
        fieldview: "textarea",
      },
    ],
    run: async ({
      row,
      configuration: { eventType, channel, payload },
      user,
    }) => {
      return await Trigger.emitEvent(
        eventType,
        channel,
        user,
        payload ? JSON.parse(payload) : row
      );
    },
  },
  webhook: {
    configFields: [
      {
        name: "url",
        label: "URL",
        type: "String",
        sublabel: "Trigger will call specified URL",
      },
      {
        name: "body",
        label: "JSON body",
        sublabel: "Leave blank to use row from table",
        type: "String",
        fieldview: "textarea", // I think that textarea is better
      },
    ],
    run: async ({ row, configuration: { url, body } }) => {
      return await fetch(url, {
        method: "post",
        body: body || JSON.stringify(row),
        headers: { "Content-Type": "application/json" },
      });
    },
  },
  send_email: {
    configFields: async ({ table }) => {
      if (!table) return [];
      const views = await View.find_table_views_where(
        table,
        ({ viewtemplate }) => viewtemplate.runMany || viewtemplate.renderRows
      );

      const view_opts = views.map((v) => v.name);
      const fields = await table.getFields();
      const field_opts = fields
        .filter((f) => f.type.name === "String" || f.reftable_name === "users")
        .map((f) => f.name);
      return [
        {
          name: "viewname",
          label: "View to send",
          sublabel:
            "Select a view that can render a single record - for instance, of the Show template.",
          input_type: "select",
          options: view_opts,
        },
        {
          name: "to_email",
          label: "Recipient email address",
          sublabel:
            "Select email addresses for send email. Choose option to get more information",
          input_type: "select",
          required: true,

          options: ["Fixed", "User", "Field"],
        },
        {
          name: "to_email_field",
          label: "Field with email address",
          sublabel:
            "Field with email address a String, or Key to user who will receive email",
          input_type: "select",

          options: field_opts,

          showIf: { to_email: "Field" },
        },
        {
          name: "to_email_fixed",
          label: "Fixed address",
          sublabel: "Email address to send emails", // todo send to few addresses?
          type: "String",
          showIf: { to_email: "Fixed" },
        },
        {
          name: "subject",
          label: "Subject",
          sublabel: "Subject of email",
          type: "String",
          required: true,
        },
      ];
    },
    requireRow: true,
    run: async ({
      row,
      table,
      configuration: {
        viewname,
        subject,
        to_email,
        to_email_field,
        to_email_fixed,
      },
      user,
    }) => {
      let to_addr;
      switch (to_email) {
        case "Fixed":
          to_addr = to_email_fixed;
          break;
        case "User":
          to_addr = user.email;
          break;
        case "Field":
          const fields = await table.getFields();
          const field = fields.find((f) => f.name === to_email_field);
          if (field && field.type.name === "String")
            to_addr = row[to_email_field];
          else if (field && field.reftable_name === "users") {
            const refuser = await User.findOne({ id: row[to_email_field] });
            to_addr = refuser.email;
          }
          break;
      }
      const view = await View.findOne({ name: viewname });
      const htmlBs = await view.run({ id: row.id }, mockReqRes);
      const html = await transformBootstrapEmail(htmlBs);
      console.log(
        "Sending email from %s to %s with subject %s to_email",
        getState().getConfig("email_from"),
        to_addr,
        subject,
        to_addr
      );
      const email = {
        from: getState().getConfig("email_from"),
        to: to_addr,
        subject,
        html,
      };
      //console.log(email);
      await getMailTransport().sendMail(email);
      return { notify: `E-mail sent to ${to_addr}` };
    },
  },
  insert_joined_row: {
    configFields: async ({ table }) => {
      if (!table) return [];
      const { child_field_list } = await table.get_child_relations();
      return [
        {
          name: "joined_table",
          label: "Relation",
          sublabel: "Relation", // todo more detailed explanation
          input_type: "select",
          options: child_field_list,
        },
      ];
    },
    requireRow: true,
    run: async ({ row, table, configuration: { joined_table }, user }) => {
      const [join_table_name, join_field] = joined_table.split(".");
      const joinTable = await Table.findOne({ name: join_table_name });
      const fields = await joinTable.getFields();
      const newRow = { [join_field]: row.id };
      for (const field of fields) {
        if (
          field.type === "Key" &&
          field.reftable_name === "users" &&
          user &&
          user.id
        )
          newRow[field.name] = user.id;
      }
      return await joinTable.insertRow(newRow);
    },
  },
  duplicate_row: {
    configFields: () => [],
    requireRow: true,
    run: async ({ row, table, user }) => {
      const newRow = { ...row };
      await table.getFields();
      delete newRow[table.pk_name];
      await table.insertRow(newRow);
      return { reload_page: true };
    },
  },
  insert_any_row: {
    configFields: async ({ table }) => {
      const tables = await Table.find();
      return [
        {
          name: "table",
          label: "Table",
          sublabel: "Table", //todo more detailed explanation
          input_type: "select",
          options: tables.map((t) => t.name),
        },
        {
          name: "row_expr",
          label: "Row expression",
          sublabel: "Expression for JavaScript object",
          type: "String",
          fieldview: "textarea",
        },
      ];
    },
    run: async ({ row, configuration: { row_expr, table }, user, ...rest }) => {
      const f = get_async_expression_function(row_expr, [], {
        row: row || {},
        user,
        console,
      });
      const calcrow = await f({});
      const table_for_insert = await Table.findOne({ name: table });
      const res = await table_for_insert.tryInsertRow(calcrow, user && user.id);
      if (res.error) return res;
      else return true;
    },
  },
  run_js_code: {
    configFields: async ({ table }) => {
      const fields = table ? (await table.getFields()).map((f) => f.name) : [];
      const vars = [
        ...(table ? ["row"] : []),
        "user",
        "console",
        "Actions",
        "Table",
        ...(table ? ["table"] : []),
        ...fields,
      ]
        .map((f) => code(f))
        .join(", ");
      return [
        {
          name: "code",
          label: "Code",
          input_type: "code",
          attributes: { mode: "application/javascript" },
          sublabel: div("Variables in scope: ", vars),
        },
      ];
    },
    run: run_code,
  },
};
