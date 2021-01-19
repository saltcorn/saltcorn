const fetch = require("node-fetch");
const vm = require("vm");
const Table = require("../models/table");
const View = require("../models/view");
const { getState } = require("../db/state");
const User = require("../models/user");
const {
  getMailTransport,
  transformBootstrapEmail,
} = require("../models/email");
const { mockReqRes } = require("../tests/mocks");
const { get_async_expression_function } = require("../models/expression");

//action use cases: field modify, like/rate (insert join), notify, send row to webhook
module.exports = {
  webhook: {
    configFields: [
      { name: "url", label: "URL", type: "String" },
      {
        name: "body",
        label: "JSON body",
        sublabel: "Leave blank to use row from table",
        type: "String",
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
        table.id,
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
          input_type: "select",
          options: view_opts,
        },
        {
          name: "to_email",
          label: "Recipient email address",
          input_type: "select",
          class: "to_email",
          required: true,

          options: ["Fixed", "User", "Field"],
        },
        {
          name: "to_email_field",
          label: "Field with address",
          sublabel:
            "Field with email address a String, or Key to user who will receive email",
          input_type: "select",

          options: field_opts,

          showIf: { ".to_email": "Field" },
        },
        {
          name: "to_email_fixed",
          label: "Fixed address",
          type: "String",
          showIf: { ".to_email": "Fixed" },
        },
        {
          name: "subject",
          label: "Subject",
          type: "String",
          required: true,
        },
      ];
    },
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
      console.log(htmlBs);
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
          input_type: "select",
          options: child_field_list,
        },
      ];
    },
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
  insert_any_row: {
    configFields: async ({ table }) => {
      const tables = await Table.find();
      return [
        {
          name: "table",
          label: "Table",
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
    configFields: [{ name: "code", label: "Code", input_type: "textarea" }],
    run: async ({ row, table, configuration: { code }, user, ...rest }) => {
      const f = vm.runInNewContext(`async () => {${code}}`, {
        Table,
        table,
        row,
        user,
        console,
        ...(row || {}),
        ...getState().function_context,
        ...rest,
      });
      return await f();
    },
  },
};
