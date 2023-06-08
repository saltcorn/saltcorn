// todo replace var with let / const
function activate_blockly({ events, actions, tables }) {
  // https://blockly-demo.appspot.com/static/demos/blockfactory/index.html#arpfmx

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
    return `console.log(${value_string});\n`;
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
    return `emitEvent("${dropdown_event}", ${value_channel}, ${value_payload});\n`;
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
    const code = "row";
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
    const code = "channel";
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
    const code = "{}";
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
    return `${value_row}.${text_key}=${value_value};\n`;
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
    return `await Table.findOne({name: '${dropdown_table}'})\n           .tryInsertRow(${value_row});\n`;
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
    return `await Table.findOne({name: '${dropdown_table}'})\n           .deleteRows({id: ${value_id}});\n`;
  };

  Blockly.Blocks["delete_table_where"] = {
    init: function () {
      this.appendDummyInput().appendField("Delete");
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown(tables.map((t) => [t.name, t.name])),
        "TABLE"
      );
      this.appendValueInput("where").setCheck("Row").appendField("where");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Delete by search condition");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["delete_table_where"] = function (block) {
    var dropdown_table = block.getFieldValue("TABLE");
    var value_where = Blockly.JavaScript.valueToCode(
      block,
      "where",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    return `await Table.findOne({name: '${dropdown_table}'})\n           .deleteRows(${value_where});\n`;
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
    return `await Table.findOne({name: '${dropdown_table}'})\n           .tryUpdateRow(${value_row}, ${value_id});\n`;
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
    const number_sleep_ms = block.getFieldValue("SLEEP_MS");
    // TODO: Assemble JavaScript into code variable.
    return `await sleep(${number_sleep_ms});\n`;
  };

  Blockly.Blocks["http_request"] = {
    init: function () {
      this.appendDummyInput().appendField("HTTP");
      this.appendDummyInput().appendField(
        new Blockly.FieldDropdown([
          ["GET", "GET"],
          ["POST", "POST"],
          ["PUT", "PUT"],
          ["DELETE", "DELETE"],
        ]),
        "METHOD"
      );
      this.appendValueInput("URL").setCheck("String").appendField("URL");
      this.appendValueInput("BODY").setCheck(null).appendField("Body");
      this.setOutput(true, null);
      this.setColour(230);
      this.setTooltip("HTTP Request");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["http_request"] = function (block) {
    var dropdown_method = block.getFieldValue("METHOD");
    var value_url = Blockly.JavaScript.valueToCode(
      block,
      "URL",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    var value_body = Blockly.JavaScript.valueToCode(
      block,
      "BODY",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `await fetchJSON(${value_url}, { method: '${dropdown_method}'${value_body
      ? `, body: ${value_body}, headers: { "Content-Type": "application/json" }`
      : ""
      } })`;
    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };

  Blockly.Blocks["return"] = {
    init: function () {
      this.appendDummyInput().appendField("Return");
      this.appendValueInput("GOTO").setCheck("String").appendField("Go to URL");
      this.appendValueInput("POPUP").setCheck("String").appendField("Popup URL");
      this.appendDummyInput()
        .appendField("Reload page")
        .appendField(new Blockly.FieldCheckbox("FALSE"), "RELOAD");
      this.appendValueInput("NOTIFY").setCheck("String").appendField("Notify");
      this.setInputsInline(false);
      this.setPreviousStatement(true, null);
      this.setColour(230);
      this.setTooltip("Return, with directions for the page");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["return"] = function (block) {
    var value_goto = Blockly.JavaScript.valueToCode(
      block,
      "GOTO",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    var value_popup = Blockly.JavaScript.valueToCode(
      block,
      "POPUP",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    var checkbox_reload = block.getFieldValue("RELOAD") === "TRUE";
    var value_notify = Blockly.JavaScript.valueToCode(
      block,
      "NOTIFY",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    let s = "";
    if (value_goto) s += `goto: ${value_goto},`;
    if (value_popup) s += `popup: ${value_popup},`;
    if (value_notify) s += `notify: ${value_notify},`;
    if (checkbox_reload) s += `reload_page: true,`;
    return `return {${s}};\n`;
  };
  Blockly.Blocks["push_to_list"] = {
    init: function () {
      this.appendDummyInput().appendField("Push to list");
      this.appendValueInput("LIST").setCheck("Array");
      this.appendDummyInput().appendField("value");
      this.appendValueInput("NAME").setCheck(null);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Append a value to a list");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["push_to_list"] = function (block) {
    var value_list = Blockly.JavaScript.valueToCode(
      block,
      "LIST",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    var value_name = Blockly.JavaScript.valueToCode(
      block,
      "NAME",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    return `${value_list}.push(${value_name});\n`;
  };
  if (actions.length > 0) {
    Blockly.Blocks["action"] = {
      init: function () {
        this.appendDummyInput().appendField("Action");
        this.appendDummyInput().appendField(
          new Blockly.FieldDropdown(actions.map((a) => [a.name, a.name])),
          "NAME"
        );
        this.setInputsInline(true);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(230);
        this.setTooltip("Run an action");
        this.setHelpUrl("");
      },
    };

    Blockly.JavaScript["action"] = function (block) {
      const dropdown_name = block.getFieldValue("NAME");
      // TODO: Assemble JavaScript into code variable.
      return dropdown_name.includes(" ")
        ? `Actions['${dropdown_name}']();\n`
        : `Actions.${dropdown_name}();\n`;
    };
  }
  Blockly.Blocks["unit_row"] = {
    init: function () {
      this.appendDummyInput().appendField("{");
      this.appendDummyInput().appendField(
        new Blockly.FieldTextInput(""),
        "KEY"
      );
      this.appendDummyInput().appendField(":");
      this.appendValueInput("VALUE").setCheck(null);
      this.appendDummyInput().appendField("}");
      this.setInputsInline(true);
      this.setOutput(true, "Row");
      this.setColour(230);
      this.setTooltip("A row with a single field");
      this.setHelpUrl("");
    },
  };
  Blockly.JavaScript["unit_row"] = function (block) {
    var text_key = block.getFieldValue("KEY");
    var value_value = Blockly.JavaScript.valueToCode(
      block,
      "VALUE",
      Blockly.JavaScript.ORDER_ATOMIC
    );
    // TODO: Assemble JavaScript into code variable.
    var code = `{${text_key}: ${value_value}}`;
    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
  };

  Blockly.Blocks["now"] = {
    init: function () {
      this.appendDummyInput().appendField("Now");
      this.setOutput(true, "Date");
      this.setColour(230);
      this.setTooltip("The current time");
      this.setHelpUrl("");
    },
  };

  Blockly.JavaScript["now"] = function (block) {
    // TODO: Assemble JavaScript into code variable.
    var code = "new Date()";
    // TODO: Change ORDER_NONE to the correct strength.
    return [code, Blockly.JavaScript.ORDER_NONE];
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
    const code = Blockly.JavaScript.workspaceToCode(workspace);
    $("#blockly_js_output").html(code);
  }
  workspace.addChangeListener(myUpdateFunction);
}
