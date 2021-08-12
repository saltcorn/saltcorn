function activate_blockly({ events, actions }) {
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

  Blockly.Blocks["emit_event"] = {
    init: function () {
      this.appendDummyInput()
        .appendField("Emit Event")
        .appendField(
          new Blockly.FieldDropdown(events.map((e) => [e, e])),
          "EVENT"
        );
      this.appendValueInput("CHANNEL")
        .setCheck("String")
        .appendField("Channel");
      this.appendValueInput("PAYLOAD").setCheck(null).appendField("Payload");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript['emit_event'] = function(block) {
    var dropdown_event = block.getFieldValue('EVENT');
    var value_channel = Blockly.JavaScript.valueToCode(block, 'CHANNEL', Blockly.JavaScript.ORDER_ATOMIC);
    var value_payload = Blockly.JavaScript.valueToCode(block, 'PAYLOAD', Blockly.JavaScript.ORDER_ATOMIC);
    // TODO: Assemble JavaScript into code variable.
    var code = `emitEvent("${dropdown_event}", ${value_channel}, ${value_payload});\n`;

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
