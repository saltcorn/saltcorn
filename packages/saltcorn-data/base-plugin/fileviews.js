const { text } = require("@saltcorn/markup/tags");
const { link } = require("@saltcorn/markup");

module.exports = {
  "Download link": {
    run: (file_id, file_name) =>
      link(`/files/download/${file_id}`, file_name || "Download")
  }
};
