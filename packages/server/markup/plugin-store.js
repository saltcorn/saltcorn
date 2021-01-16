const {
  h5,
  h4,
  nbsp,
  a,
  div,
  span,
  ul,
  li,
  button,
  table,
  tbody,
  tr,
  th,
  td,
  strong,
} = require("@saltcorn/markup/tags");

const plugin_types_info_card = (plugin, req) =>
  plugin.plugin_module.types.map((type) =>
    span({ class: "badge badge-primary ml-2" }, type.name)
  );

module.exports = { plugin_types_info_card };
