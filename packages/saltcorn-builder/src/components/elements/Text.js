import React, { useState, useContext, useEffect, Fragment } from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting, OrFormula } from "./utils";
import ContentEditable from "react-contenteditable";
import optionsCtx from "../context";
import CKEditor from "ckeditor4-react";

const ckConfig = {
  toolbarGroups: [
    { name: "document", groups: ["mode", "document", "doctools"] },
    { name: "clipboard", groups: ["clipboard", "undo"] },
    { name: "forms", groups: ["forms"] },
    { name: "basicstyles", groups: ["basicstyles", "cleanup"] },
    {
      name: "editing",
      groups: ["find", "selection", "spellchecker", "editing"],
    },
    {
      name: "paragraph",
      groups: ["list", "indent", "blocks", "align", "bidi", "paragraph"],
    },
    { name: "links", groups: ["links"] },
    "/",
    { name: "insert", groups: ["insert"] },
    { name: "styles", groups: ["styles"] },
    { name: "colors", groups: ["colors"] },
    { name: "tools", groups: ["tools"] },
    { name: "others", groups: ["others"] },
    { name: "about", groups: ["about"] },
  ],
  removeButtons:
    "Source,Save,NewPage,ExportPdf,Print,Preview,Templates,Cut,Copy,Paste,PasteText,PasteFromWord,Find,Replace,SelectAll,Form,Checkbox,Radio,TextField,Textarea,Select,Button,ImageButton,HiddenField,CopyFormatting,CreateDiv,BidiLtr,BidiRtl,Language,Anchor,Flash,Iframe,PageBreak,Maximize,ShowBlocks,About,Undo,Redo,Image",
};

export const Text = ({ text, block, isFormula, textStyle }) => {
  const {
    connectors: { connect, drag },
    selected,
    actions: { setProp },
  } = useNode((state) => ({
    selected: state.events.selected,
    dragged: state.events.dragged,
  }));
  const [editable, setEditable] = useState(false);

  useEffect(() => {
    !selected && setEditable(false);
  }, [selected]);

  return (
    <span
      className={`${textStyle} is-text ${
        isFormula.text ? "text-monospace" : ""
      } ${selected ? "selected-node" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
      onClick={(e) => selected && setEditable(true)}
    >
      {isFormula.text ? (
        <Fragment>
          =
          <ContentEditable
            html={text}
            style={{ display: "inline" }}
            disabled={!editable}
            onChange={(e) => setProp((props) => (props.text = e.target.value))}
          />
        </Fragment>
      ) : (
        <CKEditor
          data={text}
          onChange={(e) =>
            setProp((props) => (props.text = e.editor.getData()))
          }
          config={ckConfig}
          type="inline"
        />
      )}
    </span>
  );
};

export const TextSettings = () => {
  const node = useNode((node) => ({
    text: node.data.props.text,
    block: node.data.props.block,
    isFormula: node.data.props.isFormula,
    textStyle: node.data.props.textStyle,
    labelFor: node.data.props.labelFor,
  }));
  const {
    actions: { setProp },
    text,
    block,
    textStyle,
    isFormula,
    labelFor,
  } = node;
  const { mode, fields } = useContext(optionsCtx);
  return (
    <div>
      {mode === "show" && (
        <div className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            checked={isFormula.text}
            onChange={(e) =>
              setProp((prop) => (prop.isFormula.text = e.target.checked))
            }
          />
          <label className="form-check-label">Formula?</label>
        </div>
      )}
      <label>Text to display:</label>
      {mode === "show" && isFormula.text ? (
        <input
          type="text"
          className="text-to-display form-control"
          value={text}
          onChange={(e) => setProp((prop) => (prop.text = e.target.value))}
        />
      ) : (
        <CKEditor
          data={text}
          onChange={(e) =>
            setProp((props) => (props.text = e.editor.getData()))
          }
          config={ckConfig}
          type="inline"
        />
      )}
      {mode === "edit" && (
        <Fragment>
          <label>Label for Field</label>
          <select
            value={labelFor}
            onChange={(e) => {
              setProp((prop) => (prop.labelFor = e.target.value));
            }}
          >
            <option value={""}></option>
            {fields.map((f, ix) => (
              <option key={ix} value={f.name}>
                {f.label}
              </option>
            ))}
          </select>
        </Fragment>
      )}
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

Text.craft = {
  defaultProps: {
    text: "Click here",
    block: false,
    isFormula: {},
    textStyle: "",
    labelFor: "",
  },
  displayName: "Text",
  related: {
    settings: TextSettings,
  },
};
