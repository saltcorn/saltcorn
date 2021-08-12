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

const blocklyImportScripts = ({locale}) =>
  script({
    src: "https://unpkg.com/blockly@6.20210701.0/blockly_compressed.js",
  }) +
  script({
    src: "https://unpkg.com/blockly@6.20210701.0/blocks_compressed.js",
  }) +
  script({
    src: `https://unpkg.com/blockly@6.20210701.0/msg/${locale}.js`,
  }) +
  script({
    src: "https://unpkg.com/blockly@6.20210701.0/javascript_compressed.js",
  })+
  script({
    src: `/static_assets/${db.connectObj.version_tag}/blockly.js`,
  })


const blocklyToolbox = () => `
  <xml xmlns="https://developers.google.com/blockly/xml" id="toolbox" style="display: none">
    <block type="controls_if"></block>
    <block type="logic_compare"></block>
    <block type="controls_repeat_ext"></block>
    <block type="math_number">
    <field name="NUM">123</field>
    </block>
    <block type="math_arithmetic"></block>
    <block type="text"></block>
    <block type="console"></block>
    <block type="emit_event"></block>
  </xml>`;

module.exports = { blocklyImportScripts, blocklyToolbox };
