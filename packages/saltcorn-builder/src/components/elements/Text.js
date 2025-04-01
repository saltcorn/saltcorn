/**
 * @category saltcorn-builder
 * @module components/elements/Text
 * @subcategory components / elements
 */

import React, { useState, useContext, useEffect, Fragment } from "react";
import { useNode } from "@craftjs/core";
import {
  blockProps,
  BlockOrInlineSetting,
  TextStyleSetting,
  OrFormula,
  ErrorBoundary,
  TextStyleRow,
  DynamicFontAwesomeIcon,
  isBlock,
  reactifyStyles,
  SettingsRow,
  setAPropGen,
} from "./utils";
import ContentEditable from "react-contenteditable";
import optionsCtx from "../context";
import CKEditor from "ckeditor4-react";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
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
const Text = ({
  text,
  block,
  inline,
  isFormula,
  textStyle,
  icon,
  font,
  style,
  customClass,
}) => {
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
      className={`${
        isBlock(block, inline, textStyle) ? "d-block" : "d-inline-block"
      } ${customClass || ""} ${Array.isArray(textStyle) ? textStyle.join(" ") : textStyle} is-text ${
        isFormula.text ? "font-monospace" : ""
      } ${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
      onClick={(e) => selected && setEditable(true)}
      style={{
        ...(font ? { fontFamily: font } : {}),
        ...reactifyStyles(style || {}),
      }}
    >
      <DynamicFontAwesomeIcon icon={icon} className="me-1" />
      {isFormula.text ? (
        <Fragment>
          =
          <ContentEditable
            html={text}
            style={{ display: "inline" }}
            disabled={!editable}
            onChange={(e) =>
              e?.target && setProp((props) => (props.text = e.target.value))
            }
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
    inline: node.data.props.inline,
    isFormula: node.data.props.isFormula,
    textStyle: node.data.props.textStyle,
    labelFor: node.data.props.labelFor,
    customClass: node.data.props.customClass,
    icon: node.data.props.icon,
    font: node.data.props.font,
    style: node.data.props.style,
  }));
  const {
    actions: { setProp },
    text,
    block,
    inline,
    textStyle,
    isFormula,
    labelFor,
    icon,
    font,
    style,
    customClass,
  } = node;
  const { mode, fields, icons } = useContext(optionsCtx);
  const setAProp = setAPropGen(setProp);
  const allowFormula = mode === "show" || mode === "list";

  return (
    <div>
      {allowFormula && (
        <div className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            checked={isFormula.text}
            onChange={(e) => {
              if (!e.target) return;
              const checked = e.target.checked;
              setProp((prop) => (prop.isFormula.text = checked));
            }}
          />
          <label className="form-check-label">Formula?</label>
        </div>
      )}
      <label>Text to display</label>
      {allowFormula && isFormula.text ? (
        <input
          type="text"
          className="text-to-display form-control"
          value={text}
          onChange={setAProp("text")}
          spellCheck={false}
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
          <select
            value={labelFor}
            onChange={setAProp("labelFor")}
            className="form-control form-select"
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
                icons={icons}
                onChange={(value) => setProp((prop) => (prop.icon = value))}
                isMulti={false}
              />
            </td>
          </tr>
          <SettingsRow
            field={{
              name: "font",
              label: "Font family",
              type: "Font",
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "font-size",
              label: "Font size",
              type: "DimUnits",
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <SettingsRow
            field={{
              name: "font-weight",
              label: "Weight",
              type: "Integer",
              min: 100,
              max: 900,
              step: 100,
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <SettingsRow
            field={{
              name: "line-height",
              label: "Line height",
              type: "DimUnits",
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <tr>
            <td>Class</td>
            <td>
              <input
                type="text"
                value={customClass}
                className="form-control"
                onChange={setAProp("customClass")}
                spellCheck={false}
              />
            </td>
          </tr>
          <SettingsRow
            field={{
              name: "color",
              label: "Color",
              type: "Color",
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
        </tbody>
      </table>
      <BlockOrInlineSetting
        block={block}
        inline={inline}
        textStyle={textStyle}
        setProp={setProp}
      />
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
    inline: false,
    isFormula: {},
    textStyle: "",
    labelFor: "",
    font: "",
    style: {},
  },
  displayName: "Text",
  related: {
    settings: TextSettings,
  },
};
