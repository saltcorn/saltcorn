const fetch = require("node-fetch");
const vm = require("vm");
const Table = require("../models/table");
const { getState } = require("../db/state");

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
      await fetch(url, {
        method: "post",
        body: body || JSON.stringify(row),
        headers: { "Content-Type": "application/json" },
      });
    },
  },
  /*send_email: {
    configFields: [{ name: "view", label: "URL", type: "String" }],
  },*/
  run_js_code: {
    configFields: [{ name: "code", label: "Code", input_type: "textarea" }],
    run: async ({ row, table, configuration: { code } }) => {
      const f = vm.runInNewContext(`async () => {${code}}`, {
        Table,
        table,
        row,
        ...getState().function_context,
      });
      await f();
    },
  },
};
