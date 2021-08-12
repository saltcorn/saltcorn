function activate_blockly() {
  Blockly.Blocks["console"] = {
    init: function () {
      this.appendValueInput("STRING")
        .setCheck("String")
        .appendField(new Blockly.FieldLabelSerializable("Console"), "STRING");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["console"] = function (block) {
    var value_string = Blockly.JavaScript.valueToCode(
      block,
      "STRING",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `console.log(${value_string});\n`;
    return code;
  };
  const workspace = Blockly.inject("blocklyDiv", {
    media: "../../media/",
    toolbox: document.getElementById("toolbox"),
  });
  const stored = $("#blocklyForm input[name=workspace]").val();
  if (stored) {
    const xml = Blockly.Xml.textToDom(stored);
    Blockly.Xml.domToWorkspace(xml, workspace);
  }
  $("#blocklySave").click(() => {
    const dom = Blockly.Xml.workspaceToDom(workspace);
    const s = Blockly.Xml.domToText(dom);
    $("#blocklyForm input[name=workspace]").val(s);
    const code = Blockly.JavaScript.workspaceToCode(workspace);
    $("#blocklyForm input[name=code]").val(code);
    $("#blocklyForm").submit();
  });
}
