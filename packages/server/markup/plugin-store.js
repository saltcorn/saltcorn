/**
 * @category server
 * @module markup/plugin-store
 * @subcategory markup
 */

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
const { link } = require("@saltcorn/markup");

/**
 * @param {object} args
 * @returns {string}
 */
const show_function_arguments = (args) =>
  (args || []).map(({ name, type }) => `${name}: ${type}`).join(", ");

/**
 * @param {object} plugin
 * @param {string} key
 * @param {object} def
 * @returns {*}
 */
const withCfg = (plugin, key, def) =>
  plugin.plugin_module.configuration_workflow
    ? plugin.plugin_module[key]
      ? plugin.plugin_module[key](plugin.configuration || {})
      : def
    : plugin.plugin_module[key] || def;

/**
 * @param {object} plugin
 * @param {object} req
 * @returns {*}
 */
const plugin_types_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Types"),
  contents: plugin.plugin_module.types.map((type) =>
    span({ class: "badge bg-primary ms-2" }, type.name)
  ),
});

/**
 * @param {object} plugin
 * @param {object} req
 * @returns {*}
 */
const plugin_functions_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Functions"),
  contents: Object.entries(withCfg(plugin, "functions", {}))
    .map(([nm, v]) =>
      div(
        h4(
          { class: "d-inline me-2" },
          `${nm}(${show_function_arguments(v["arglist"])})`
        ),
        v.isAsync && span({ class: "badge bg-primary" }, "async"),
        v.returns ? p(req.__("Returns: "), v.returns) : null,
        p(v.description)
      )
    )
    .join("<hr>"),
});

/**
 * @param {object} plugin
 * @param {object} req
 * @returns {*}
 */
const plugin_viewtemplates_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("View patterns"),
  contents: withCfg(plugin, "viewtemplates", [])
    .map(({ name, description }) => div(h4(name), p(description)))
    .join("<hr>"),
});

/**
 * @param {object} repo
 * @returns {*}
 */
const showRepository = (repo) =>
  !repo
    ? repo
    : repo.url
      ? link(repo.url, repo.url)
      : repo.startsWith && repo.startsWith("github:")
        ? link(repo.replace("github:", "https://github.com/"), repo)
        : repo;

module.exports = {
  plugin_types_info_card,
  plugin_functions_info_card,
  plugin_viewtemplates_info_card,
  showRepository,
};
