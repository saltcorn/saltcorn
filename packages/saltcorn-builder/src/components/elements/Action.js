/**
 * @category saltcorn-builder
 * @module components/elements/Action
 * @subcategory components / elements
 */

import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  blockProps,
  BlockSetting,
  MinRoleSettingRow,
  OrFormula,
  ConfigForm,
  setInitialConfig,
  ButtonOrLinkSettingsRows,
  DynamicFontAwesomeIcon,
} from "./utils";

export /**
 *
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.block
 * @param {string} props.action_label
 * @param {string} props.action_style
 * @param {string} props.action_icon
 * @param {string} props.action_size
 * @param {string} props.action_bgcol
 * @param {string} props.action_bordercol
 * @param {string} props.action_textcol
 * @returns {span|btn}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const Action = ({
  name,
  block,
  action_label,
  action_style,
  action_icon,
  action_size,
  action_bgcol,
  action_bordercol,
  action_textcol,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  /**
   * @type {object}
   */
  return (
    <button
      className={`btn ${action_style || "btn-primary"} ${action_size || ""} ${
        selected ? "selected-node" : ""
      } ${block ? "d-block" : ""}`}
      ref={(dom) => connect(drag(dom))}
      style={
        action_style === "btn-custom-color"
          ? {
              backgroundColor: action_bgcol || "#000000",
              borderColor: action_bordercol || "#000000",
              color: action_textcol || "#000000",
            }
          : {}
      }
    >
      <DynamicFontAwesomeIcon icon={action_icon} className="me-1" />
      {action_label || name}
    </button>
  );
};

export /**
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 * @returns {div}
 */
const ActionSettings = () => {
  const node = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    minRole: node.data.props.minRole,
    confirm: node.data.props.confirm,
    action_label: node.data.props.action_label,
    configuration: node.data.props.configuration,
    isFormula: node.data.props.isFormula,
    action_style: node.data.props.action_style,
    action_size: node.data.props.action_size,
    action_icon: node.data.props.action_icon,
    action_bgcol: node.data.props.action_bgcol,
    action_bordercol: node.data.props.action_bordercol,
    action_textcol: node.data.props.action_textcol,
  }));
  const {
    actions: { setProp },
    name,
    block,
    minRole,
    isFormula,
    confirm,
    configuration,
    action_label,
  } = node;
  const options = useContext(optionsCtx);
  const getCfgFields = (fv) => (options.actionConfigForms || {})[fv];
  const cfgFields = getCfgFields(name);
  return (
    <div>
      <table className="w-100">
        <tbody>
          <tr>
            <td>
              <label>Action</label>
            </td>
            <td>
              <select
                value={name}
                className="form-control form-select"
                onChange={(e) => {
                  setProp((prop) => (prop.name = e.target.value));
                  setInitialConfig(
                    setProp,
                    e.target.value,
                    getCfgFields(e.target.value)
                  );
                }}
              >
                {options.actions.map((f, ix) => (
                  <option key={ix} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <label>Label (leave blank for default)</label>
              <OrFormula
                nodekey="action_label"
                {...{ setProp, isFormula, node }}
              >
                <input
                  type="text"
                  className="form-control"
                  value={action_label}
                  onChange={(e) =>
                    setProp((prop) => (prop.action_label = e.target.value))
                  }
                />
              </OrFormula>
            </td>
          </tr>
          <ButtonOrLinkSettingsRows
            setProp={setProp}
            keyPrefix="action_"
            values={node}
          />
          <MinRoleSettingRow minRole={minRole} setProp={setProp} />
        </tbody>
      </table>
      {options.mode === "show" ? (
        <div className="form-check">
          <input
            className="form-check-input"
            name="block"
            type="checkbox"
            checked={confirm}
            onChange={(e) =>
              setProp((prop) => (prop.confirm = e.target.checked))
            }
          />
          <label className="form-check-label">User confirmation?</label>
        </div>
      ) : null}
      <BlockSetting block={block} setProp={setProp} />

      {cfgFields ? (
        <ConfigForm
          fields={cfgFields}
          configuration={configuration}
          setProp={setProp}
          node={node}
        />
      ) : null}
    </div>
  );
};

/**
 * @type {object}
 */
Action.craft = {
  displayName: "Action",
  related: {
    settings: ActionSettings,
  },
};
