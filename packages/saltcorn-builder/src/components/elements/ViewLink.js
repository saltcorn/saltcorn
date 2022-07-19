/**
 * @category saltcorn-builder
 * @module components/elements/ViewLink
 * @subcategory components / elements
 */

import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  blockProps,
  BlockSetting,
  MinRoleSettingRow,
  OrFormula,
  TextStyleSetting,
  ButtonOrLinkSettingsRows,
} from "./utils";

export /**
 * @param {object} props
 * @param {string} props.name
 * @param {boolean} props.block
 * @param {*} props.minRole
 * @param {string} props.link_style
 * @param {string} props.link_size
 * @param {string} [props.link_icon]
 * @param {boolean} props.inModal
 * @param {string} [props.label]
 * @param {string} props.textStyle
 * @param {string} [props.link_bgcol]
 * @param {string} [props.link_bordercol]
 * @param {string} [props.link_textcol]
 * @returns {tr}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const ViewLink = ({
  name,
  block,
  minRole,
  link_style,
  link_size,
  link_icon,
  inModal,
  label,
  textStyle,
  link_bgcol,
  link_bordercol,
  link_textcol,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const names = name.split(":");
  const displabel = label || (names.length > 1 ? names[1] : names[0]);
  return (
    <span
      className={`${textStyle} ${inModal ? "btn btn-secondary btn-sm" : ""} ${
        selected ? "selected-node" : "is-builder-link"
      } ${link_style} ${link_size}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
      style={
        link_style === "btn btn-custom-color"
          ? {
              backgroundColor: link_bgcol || "#000000",
              borderColor: link_bordercol || "#000000",
              color: link_textcol || "#000000",
            }
          : {}
      }
    >
      {link_icon ? <i className={`${link_icon} me-1`}></i> : ""}
      {displabel}
    </span>
  );
};

export /**
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const ViewLinkSettings = () => {
  const node = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    minRole: node.data.props.minRole,
    isFormula: node.data.props.isFormula,
    label: node.data.props.label,
    inModal: node.data.props.inModal,
    link_style: node.data.props.link_style,
    link_size: node.data.props.link_size,
    link_icon: node.data.props.link_icon,
    textStyle: node.data.props.textStyle,
    link_bgcol: node.data.props.link_bgcol,
    link_bordercol: node.data.props.link_bordercol,
    link_textcol: node.data.props.link_textcol,
    extra_state_fml: node.data.props.extra_state_fml,
  }));
  const {
    actions: { setProp },
    name,
    block,
    minRole,
    label,
    isFormula,
    inModal,
    textStyle,
    extra_state_fml,
  } = node;
  const options = useContext(optionsCtx);
  let errorString = false;
  try {
    Function("return " + extra_state_fml);
  } catch (error) {
    errorString = error.message;
  }
  return (
    <div>
      <table className="w-100">
        <tbody>
          <tr>
            <td colSpan="2">
              <label>View to link to</label>
              <select
                value={name}
                className="form-control form-select"
                onChange={(e) =>
                  e?.target && setProp((prop) => (prop.name = e.target.value))
                }
              >
                {options.link_view_opts.map((f, ix) => (
                  <option key={ix} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <label>Label (leave blank for default)</label>
              <OrFormula nodekey="label" {...{ setProp, isFormula, node }}>
                <input
                  type="text"
                  className="viewlink-label form-control"
                  value={label}
                  onChange={(e) =>
                    e?.target &&
                    setProp((prop) => (prop.label = e.target.value))
                  }
                />
              </OrFormula>
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <label>Extra state Formula</label>
              <input
                type="text"
                className="viewlink-label form-control"
                value={extra_state_fml}
                onChange={(e) =>
                  e?.target &&
                  setProp((prop) => (prop.extra_state_fml = e.target.value))
                }
              />
              {errorString ? (
                <small className="text-danger font-monospace d-block">
                  {errorString}
                </small>
              ) : null}
            </td>
          </tr>

          <ButtonOrLinkSettingsRows
            setProp={setProp}
            keyPrefix="link_"
            btnClass="btn"
            values={node}
            linkFirst={true}
          />
        </tbody>
      </table>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={inModal}
          onChange={(e) => e?.target && setProp((prop) => (prop.inModal = e.target.checked))}
        />
        <label className="form-check-label">Open in popup modal?</label>
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
      <table>
        <tbody>
          <MinRoleSettingRow minRole={minRole} setProp={setProp} />
        </tbody>
      </table>
    </div>
  );
};

/**
 * @type {object}
 */
ViewLink.craft = {
  displayName: "ViewLink",
  defaultProps: {
    isFormula: {},
  },
  related: {
    settings: ViewLinkSettings,
    segment_type: "view_link",
    column_type: "ViewLink",
    fields: [
      { name: "name", segment_name: "view", column_name: "view" },
      { name: "label", segment_name: "view_label", canBeFormula: true },
      "block",
      "textStyle",
      { name: "inModal", segment_name: "in_modal", column_name: "in_modal" },
      "minRole",
      "link_style",
      "link_icon",
      "link_size",
      "link_bgcol",
      "link_bordercol",
      "link_textcol",
      "extra_state_fml",
    ],
  },
};
