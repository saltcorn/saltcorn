const fetch = require("node-fetch");

module.exports = {
  webhook: {
    configFields: [{ name: "url", label: "URL", type: "String" }],
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
};
