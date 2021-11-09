/**
 * @category saltcorn-builder
 * @module components/elements/Text
 * @subcategory components / elements
 */

import React, { useState, useContext, useEffect, Fragment } from "react";
import { useNode } from "@craftjs/core";
import {
  blockProps,
  BlockSetting,
  TextStyleSetting,
  OrFormula,
  ErrorBoundary,
  TextStyleRow,
  DynamicFontAwesomeIcon,
} from "./utils";
import ContentEditable from "react-contenteditable";
import optionsCtx from "../context";
import CKEditor from "ckeditor4-react";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
import faIcons from "./faicons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import fas from "@fortawesome/free-solid-svg-icons";
import far from "@fortawesome/free-regular-svg-icons";
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
  autoParagraph: false,
  fillEmptyBlocks: false,
  removeButtons:
    "Source,Save,NewPage,ExportPdf,Print,Preview,Templates,Cut,Copy,Paste,PasteText,PasteFromWord,Find,Replace,SelectAll,Form,Checkbox,Radio,TextField,Textarea,Select,Button,ImageButton,HiddenField,CopyFormatting,CreateDiv,BidiLtr,BidiRtl,Language,Anchor,Flash,Iframe,PageBreak,Maximize,ShowBlocks,About,Undo,Redo,Image",
};

/**
 * @param {string} str 
 * @returns {string}
 */
function escape_tags(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export /**
 * @param {object} props
 * @param {string} props.text
 * @param {boolean} props.block
 * @param {object} props.isFormula
 * @param {string} props.textStyle
 * @param {string} [props.icon]
 * @param {string} [props.font]
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const Text = ({ text, block, isFormula, textStyle, icon, font }) => {
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
    <div
      className={`${!block ? "d-inline-block" : ""} ${textStyle} is-text ${
        isFormula.text ? "text-monospace" : ""
      } ${selected ? "selected-node" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
      onClick={(e) => selected && setEditable(true)}
      style={font ? { fontFamily: font } : {}}
    >
      <DynamicFontAwesomeIcon icon={icon} className="mr-1" />
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
      ) : editable ? (
        <ErrorBoundary>
          <CKEditor
            data={text}
            style={{ display: "inline" }}
            onChange={(e) =>
              setProp((props) => (props.text = e.editor.getData()))
            }
            config={ckConfig}
            type="inline"
          />
        </ErrorBoundary>
      ) : (
        <div className="d-inline" dangerouslySetInnerHTML={{ __html: text }} />
      )}
    </div>
  );
};
//<div dangerouslySetInnerHTML={{ __html: text }} />

export /**
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
*/
const TextSettings = () => {
  const node = useNode((node) => ({
    text: node.data.props.text,
    block: node.data.props.block,
    isFormula: node.data.props.isFormula,
    textStyle: node.data.props.textStyle,
    labelFor: node.data.props.labelFor,
    icon: node.data.props.icon,
    font: node.data.props.font,
  }));
  const {
    actions: { setProp },
    text,
    block,
    textStyle,
    isFormula,
    labelFor,
    icon,
    font,
  } = node;
  const { mode, fields } = useContext(optionsCtx);
  const setAProp = (key) => (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop[key] = target_value));
    }
  };
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
      <label>Text to display</label>
      {mode === "show" && isFormula.text ? (
        <input
          type="text"
          className="text-to-display form-control"
          value={text}
          onChange={setAProp("text")}
        />
      ) : (
        <ErrorBoundary>
          <div className="border">
            <CKEditor
              data={text}
              onChange={(e) => {
                if (e.editor) {
                  const text = e.editor.getData();
                  setProp((props) => (props.text = text));
                }
              }}
              config={ckConfig}
              type="inline"
            />
          </div>
        </ErrorBoundary>
      )}
      {mode === "edit" && (
        <Fragment>
          <label>Label for Field</label>
          <select value={labelFor} onChange={setAProp("labelFor")}>
            <option value={""}></option>
            {fields.map((f, ix) => (
              <option key={ix} value={f.name}>
                {f.label}
              </option>
            ))}
          </select>
        </Fragment>
      )}
      <table className="w-100 mt-2">
        <tbody>
          <TextStyleRow textStyle={textStyle} setProp={setProp} />
          <tr>
            <td>
              <label>Icon</label>
            </td>
            <td>
              <FontIconPicker
                className="w-100"
                value={icon}
                icons={faIcons}
                onChange={(value) => setProp((prop) => (prop.icon = value))}
                isMulti={false}
              />
            </td>
          </tr>
          <tr>
            <td>
              <label>Font</label>
            </td>
            <td>
              <input
                type="text"
                className="form-control"
                value={font}
                onChange={setAProp("font")}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <BlockSetting block={block} setProp={setProp} />
    </div>
  );
};

/**
 * @type {object}
 */
Text.craft = {
  defaultProps: {
    text: "Click here",
    block: false,
    isFormula: {},
    textStyle: "",
    labelFor: "",
    font: "",
  },
  displayName: "Text",
  related: {
    settings: TextSettings,
  },
};
