function activate_blockly({ events, actions, tables }) {
  // https://blockly-demo.appspot.com/static/demos/blockfactory/index.html#zsr66a

  Blockly.Blocks["console"] = {
    init: function () {
      this.appendValueInput("STRING")
        .setCheck(null)
        .appendField(new Blockly.FieldLabelSerializable("Console"), "STRING");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Print to the server process standard output");
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
      this.setTooltip("Emit an event");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["emit_event"] = function (block) {
    var dropdown_event = block.getFieldValue("EVENT");
    var value_channel = Blockly.JavaScript.valueToCode(
      block,
      "CHANNEL",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    var value_payload = Blockly.JavaScript.valueToCode(
      block,
      "PAYLOAD",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `emitEvent("${dropdown_event}", ${value_channel}, ${value_payload});\n`;

    return code;
  };

  Blockly.Blocks["row"] = {
    init: function () {
      this.appendDummyInput().appendField("Current Payload");
      this.setOutput(true, "Row");
      this.setColour(230);
      this.setTooltip("The payload of the triggering event");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["row"] = function (block) {
    // TODO: Assemble JavaScript into code variable.
    var code = "row";
    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };

  Blockly.Blocks["current_channel"] = {
    init: function () {
      this.appendDummyInput().appendField("Current Channel");
      this.setOutput(true, "String");
      this.setColour(230);
      this.setTooltip("The current event channel");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["current_channel"] = function (block) {
    // TODO: Assemble JavaScript into code variable.
    var code = "channel";
    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };
  Blockly.Blocks["empty"] = {
    init: function () {
      this.appendDummyInput().appendField("{ }");
      this.setOutput(true, "Row");
      this.setColour(230);
      this.setTooltip("Empty row");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["empty"] = function (block) {
    // TODO: Assemble JavaScript into code variable.
    var code = "{}";
    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };

  Blockly.Blocks["row_get"] = {
    init: function () {
      this.appendValueInput("ROW").setCheck("Row");
      this.appendDummyInput().appendField(".");
      this.appendDummyInput().appendField(
        new Blockly.FieldTextInput(""),
        "KEY"
      );
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setColour(230);
      this.setTooltip("Get a value from a row by key");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["row_get"] = function (block) {
    var value_row = Blockly.JavaScript.valueToCode(
      block,
      "ROW",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    var text_key = block.getFieldValue("KEY");
    // TODO: Assemble JavaScript into code variable.
    var code = `${value_row}.${text_key}`;
    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };

  Blockly.Blocks["row_set"] = {
    init: function () {
      this.appendValueInput("ROW").setCheck("Row");
      this.appendDummyInput().appendField(".");
      this.appendDummyInput().appendField(
        new Blockly.FieldTextInput(""),
        "KEY"
      );
      this.appendDummyInput().appendField("=");
      this.appendValueInput("VALUE").setCheck(null);
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Set a value in a row by key. Overwrite if present");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["row_set"] = function (block) {
    var value_row = Blockly.JavaScript.valueToCode(
      block,
      "ROW",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    var text_key = block.getFieldValue("KEY");
    var value_value = Blockly.JavaScript.valueToCode(
      block,
      "VALUE",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `${value_row}.${text_key}=${value_value};\n`;
    return code;
  };
  Blockly.Blocks["insert_table"] = {
    init: function () {
      this.appendDummyInput().appendField("Insert into");
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown(tables.map((t) => [t.name, t.name])),
        "TABLE"
      );
      this.appendValueInput("ROW").setCheck(null).appendField("row");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Insert a row into a table");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["insert_table"] = function (block) {
    var dropdown_table = block.getFieldValue("TABLE");
    var value_row = Blockly.JavaScript.valueToCode(
      block,
      "ROW",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `await Table.findOne({name: '${dropdown_table}'})\n           .tryInsertRow(${value_row});\n`;
    return code;
  };
  Blockly.Blocks["query_table"] = {
    init: function () {
      this.appendDummyInput().appendField("Query");
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown(tables.map((t) => [t.name, t.name])),
        "TABLE"
      );
      this.appendValueInput("RESTRICT").setCheck("Row").appendField("where");
      this.setInputsInline(false);
      this.setOutput(true, "LIST");
      this.setColour(230);
      this.setTooltip("Query a list of rows from a table");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["query_table"] = function (block) {
    var dropdown_table = block.getFieldValue("TABLE");
    var value_restrict = Blockly.JavaScript.valueToCode(
      block,
      "RESTRICT",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `await Table.findOne({name: '${dropdown_table}'}).getRows(${value_restrict})`;

    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };
  Blockly.Blocks["query_one_table"] = {
    init: function () {
      this.appendDummyInput().appendField("Query one");
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown(tables.map((t) => [t.name, t.name])),
        "TABLE"
      );
      this.appendValueInput("RESTRICT").setCheck("Row").appendField("where");
      this.setInputsInline(false);
      this.setOutput(true, "Row");
      this.setColour(230);
      this.setTooltip("Query first matching row from a table");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["query_one_table"] = function (block) {
    var dropdown_table = block.getFieldValue("TABLE");
    var value_restrict = Blockly.JavaScript.valueToCode(
      block,
      "RESTRICT",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `await Table.findOne({name: '${dropdown_table}'}).getRow(${value_restrict})`;

    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };

  Blockly.Blocks["delete_table"] = {
    init: function () {
      this.appendDummyInput().appendField("Delete");
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown(tables.map((t) => [t.name, t.name])),
        "TABLE"
      );
      this.appendValueInput("ID").setCheck(null).appendField("id");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Delete a row in a table");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["delete_table"] = function (block) {
    var dropdown_table = block.getFieldValue("TABLE");
    var value_id = Blockly.JavaScript.valueToCode(
      block,
      "ID",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `await Table.findOne({name: '${dropdown_table}'})\n           .deleteRows({id: ${value_id}});\n`;
    return code;
  };
  Blockly.Blocks["update_table"] = {
    init: function () {
      this.appendDummyInput().appendField("Update");
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown(tables.map((t) => [t.name, t.name])),
        "TABLE"
      );
      this.appendValueInput("ID").setCheck(null).appendField("id");
      this.appendValueInput("ROW").setCheck("Row").appendField("row");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Update a row in a table");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["update_table"] = function (block) {
    var dropdown_table = block.getFieldValue("TABLE");
    var value_id = Blockly.JavaScript.valueToCode(
      block,
      "ID",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    var value_row = Blockly.JavaScript.valueToCode(
      block,
      "ROW",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `await Table.findOne({name: '${dropdown_table}'})\n           .tryUpdateRow(${value_row}, ${value_id});\n`;
    return code;
  };

  Blockly.Blocks["sleep"] = {
    init: function () {
      this.appendDummyInput().appendField("Sleep");
      this.appendDummyInput().appendField(
        new Blockly.FieldNumber(0, 0),
        "SLEEP_MS"
      );
      this.appendDummyInput().appendField("ms");
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Sleep for some milliseconds");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["sleep"] = function (block) {
    var number_sleep_ms = block.getFieldValue("SLEEP_MS");
    // TODO: Assemble JavaScript into code variable.
    var code = `await sleep(${number_sleep_ms});\n`;
    return code;
  };
  // -------------------
  // Activate blockly
  // -------------------
  const workspace = Blockly.inject("blocklyDiv", {
    media: false,
    sounds: false,
    toolbox: document.getElementById("toolbox"),
  });
  const stored = $("#blocklyForm input[name=workspace]").val();
  if (stored && stored !== "undefined") {
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
  function myUpdateFunction(event) {
    var code = Blockly.JavaScript.workspaceToCode(workspace);
    $("#blockly_js_output").html(code);
  }
  workspace.addChangeListener(myUpdateFunction);
}
