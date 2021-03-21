const { text, a, img } = require("@saltcorn/markup/tags");
const { link } = require("@saltcorn/markup");

module.exports = {
  "Download link": {
    run: (file_id, file_name) =>
      link(`/files/download/${file_id}`, file_name || "Download"),
  },
  Link: {
    run: (file_id, file_name) =>
      link(`/files/serve/${file_id}`, file_name || "Open"),
  },
  "Link (new tab)": {
    run: (file_id, file_name) =>
      a(
        { href: `/files/serve/${file_id}`, target: "_blank" },
        file_name || "Open"
      ),
  },
  "Show Image": {
    run: (file_id, file_name) =>
      img({ src: `/files/download/${file_id}`, style: "width: 100%" }),
  },
};
