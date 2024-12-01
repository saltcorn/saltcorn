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
 * Return Types card for Plugin
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
 * Return Functions card for Plugin
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
 * Return View Templates card for Plugin
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
 * Return Model Patterns card for Plugin
 * @param {object} plugin
 * @param {object} req
 * @returns {*}
 */
const plugin_modelpatterns_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Model patterns"),
  contents: req.__("This plugin supplies a Model Patterns.")+ 
    Object.entries(withCfg(plugin, "modelpatterns", {})).map(([nm, v]) =>
      div(h4(nm)))
      .join("<hr>"), 
});
// + checked on sql plugin 
// + checked on nextcloud plugin
const plugin_actions_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Actions"),
  contents: req.__("This plugin supplies an Actions.")+
    Object.entries(withCfg(plugin, "actions", {})).map(([nm, v]) =>
      div(h4(nm)))
      .join("<hr>"),
})
// + checked on signature-pad
const plugin_fileviews_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("FileViews"),
  contents: req.__("This plugin supplies a FileViews.")+
    Object.entries(withCfg(plugin, "fileviews", {})).map(([nm, v]) =>
      div(h4(nm)))
      .join("<hr>"),
})
// + checked on signature-pad
const plugin_fieldviews_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("FieldViews"),
  contents: req.__("This plugin supplies a FieldViews.")+
    Object.entries(withCfg(plugin, "fieldviews", {})).map(([nm, v]) =>
      div(h4(nm)))
      .join("<hr>"),
})
// + checked on system-info
const plugin_externaltables_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("External Tables"),
  contents: req.__("This plugin supplies a External Tables.")+
    Object.entries(withCfg(plugin, "external_tables", {})).map(([nm, v]) =>
      div(h4(nm)))
      .join("<hr>"),
})
// + checked on sql
const plugin_tableproviders_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Table Providers"),
  contents: req.__("This plugin supplies a Table Providers.")+
    Object.entries(withCfg(plugin, "table_providers", {})).map(([nm, v]) =>
      div(h4(nm)))
      .join("<hr>"),
})

const plugin_fonts_info_card = (plugin, req) => ({
  type: "card",
  title:  req.__("Fonts"),
  contents: req.__("This plugin supplies a Fonts."),
})
// + checked on nextcloud plugin
const plugin_eventtypes_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Event Types"),
  contents: req.__("This plugin supplies a Event Types.")+
    Object.entries(withCfg(plugin, "eventTypes", {})).map(([nm, v]) =>
      div(h4(nm)))
      .join("<hr>"),
})

const plugin_routes_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Routes"),
  contents: req.__("This plugin supplies a Routes."),
})
const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headers2str = (header) =>{
  if( header.script   ) return `script=${header.script}`;
  if( header.css      ) return `css=${header.css}`;
  if( header.headerTag) return "headerTag";  
  return "";
  
}  
const plugin_headers_info_card = (plugin, req) => ({
  type: "card",
  title: req.__("Headers"),
  contents: req.__("This plugin supplies a Headers.")+ 
    Object.entries(withCfg(plugin, "headers", {})).map(([nm, val]) =>
      div(headers2str(val)))
      .join("<hr>"),
})

/**
 * Return plugin repository 
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
  showRepository,
  plugin_types_info_card,
  plugin_functions_info_card,
  plugin_viewtemplates_info_card,
  plugin_actions_info_card,
  plugin_modelpatterns_info_card,
  plugin_externaltables_info_card,
  plugin_tableproviders_info_card,
  plugin_fileviews_info_card,
  plugin_fieldviews_info_card,
  plugin_fonts_info_card,
  plugin_routes_info_card,
  plugin_eventtypes_info_card,
  plugin_headers_info_card,
};
