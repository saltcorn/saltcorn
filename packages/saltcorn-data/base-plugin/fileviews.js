const { text, img } = require("@saltcorn/markup/tags");
const { link } = require("@saltcorn/markup");

module.exports = {
  "Download link": {
    run: (file_id, file_name) =>
      link(`/files/download/${file_id}`, file_name || "Download")
  },
  "Show Image": {
    run: (file_id, file_name) =>
      img({ src: `/files/download/${file_id}`, style: "width: 100%" })
  }
};
