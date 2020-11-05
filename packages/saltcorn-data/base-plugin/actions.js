const fetch = require("node-fetch");
//action use cases: field modify, like/rate (insert join), notify, send row to webhook
module.exports = {
  webhook: {
    configFields: [{ name: "url", label: "URL", type: "String" }],
    need: ["row"],
    run: async ({ row, config: { url } }) => {
      await fetch(url, {
        method: "post",
        body: JSON.stringify(row),
        headers: { "Content-Type": "application/json" },
      });
    },
  },
  sendmail: {
    configFields: [{ name: "view", label: "URL", type: "String" }],
  },
  anyJS: {
    configFields: [{ name: "code", label: "Code", type: "String" }],
    run: async ({ config: { code } }) => {
      eval(code);
    },
  },
};
