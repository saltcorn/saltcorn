/**
 * @category server
 * @module markup/blockly
 * @subcategory markup
 */

const {
  div,
  code,
  a,
  span,
  script,
  domReady,
  button,
} = require("@saltcorn/markup/tags");
const db = require("@saltcorn/data/db");

/**
 * @param {object} opts
 * @param {string} opts.locale
 * @returns {string}
 */
const blocklyImportScripts = ({ locale }) =>
  script({
    src: "/plugins/pubdeps/base/blockly/6.20210701.0/blockly_compressed.js",
  }) +
  script({
    src: "/plugins/pubdeps/base/blockly/6.20210701.0/blocks_compressed.js",
  }) +
  script({
    src: `/plugins/pubdeps/base/blockly/6.20210701.0/msg/${locale}.js`,
  }) +
  script({
    src: "/plugins/pubdeps/base/blockly/6.20210701.0/javascript_compressed.js",
  }) +
  script({
    src: `/static_assets/${db.connectObj.version_tag}/blockly.js`,
  });

/**
 * @param {boolean} hasActions 
 * @returns {string}
 */
const blocklyToolbox = (hasActions) => `
  <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
    <category name="Control Flow"  categorystyle="loop_category">
      <block type="controls_if"></block>
      <block type="controls_repeat_ext"></block>
      <block type="controls_forEach"></block>
      <block type="controls_whileUntil"></block>
    </category>

    <category name="Logic" categorystyle="logic_category">
      <block type="logic_compare"></block>
      <block type="logic_operation"></block>
      <block type="logic_negate"></block>
      <block type="logic_ternary"></block>
      <block type="logic_boolean"></block>
    </category>
    
    <category name="Math" categorystyle="math_category">
      <block type="math_number">
        <field name="NUM">123</field>
      </block>
      <block type="math_arithmetic"></block>
    </category>
    
    <category name="Text" categorystyle="text_category">
      <block type="text"></block>
      <block type="text_join"></block>
      <block type="text_append"></block>
      <block type="current_channel"></block>
    </category>
    
    <category name="Rows"  colour="20">
    <block type="empty"></block>
    <block type="unit_row"></block>
    <block type="row"></block>
    <block type="row_get"></block>
    <block type="row_set"></block>
    <block type="query_table"></block>
    <block type="query_one_table"></block>
    <block type="insert_table"></block>
    <block type="update_table"></block>
    <block type="delete_table"></block>
    <block type="delete_table_where"></block>
    </category>

    <category name="Lists" categorystyle="list_category">
    <block type="lists_create_empty"></block>
    <block type="push_to_list"></block>
    <block type="lists_length"></block>
    <block type="lists_getIndex"></block>
    
    </category>
    <category name="Actions"  colour="80">
      <block type="console"></block>
      ${hasActions ? `<block type="action"></block>` : ""}
      <block type="emit_event"></block>
      <block type="http_request"></block>
      <block type="sleep"></block>
      <block type="return"></block>

    </category>
    
    <category name="Variables" categorystyle="variable_category">
    <block type="variables_get"></block>
    <block type="variables_set"></block>
    <block type="now"></block>
    </category>

  </xml>`;

module.exports = { blocklyImportScripts, blocklyToolbox };
