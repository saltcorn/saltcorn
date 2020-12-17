const fetch = require("node-fetch");
const vm = require("vm");
const Table = require("../models/table");
const View = require("../models/view");
const { getState } = require("../db/state");
const { findOne } = require("../models/file");

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
          name: "view",
          label: "View to send",
          type: "String",
          required: true,
          attributes: {
            options: view_opts.join(),
          },
        },
        {
          name: "to_email",
          label: "Recipient email address",
          type: "String",
          class: "to_email",
          required: true,
          attributes: {
            options: "Fixed,User,Field",
          },
        },
        {
          name: "to_email_field",
          label: "Field with address",
          sublabel:
            "Field with email address a String, or Key to user who will receive email",
          type: "String",
          required: true,
          attributes: {
            options: field_opts.join(),
          },
          showIf: { ".to_email": "Field" },
        },
        {
          name: "to_email_fixed",
          label: "Fixed address",
          type: "String",
          required: true,
          showIf: { ".to_email": "Field" },
        },
      ];
    },
    run: async ({ row, table, configuration: { joined_table }, user }) => {},
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
