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
  p,
  td,
  strong,
} = require("@saltcorn/markup/tags");

const show_function_arguments = (args) => (args || []).join(", ");

const plugin_types_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Types"),
  contents: plugin.plugin_module.types.map((type) =>
    span({ class: "badge badge-primary ml-2" }, type.name)
  ),
});

const plugin_functions_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Functions"),
  contents: Object.entries(plugin.plugin_module.functions)
    .map(([nm, v]) =>
      div(
        h4(
          { class: "d-inline mr-2" },
          `${nm}(${show_function_arguments(v.arguments)})`
        ),
        v.isAsync && span({ class: "badge badge-primary" }, "async"),
        v.returns ? p(req.__("Returns: "), v.returns) : null,
        p(v.description)
      )
    )
    .join("<hr>"),
});

module.exports = { plugin_types_info_card, plugin_functions_info_card };
