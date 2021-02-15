import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import faIcons from "./faicons";
import {
  blockProps,
  BlockSetting,
  MinRoleSettingRow,
  OrFormula,
  ConfigForm,
  setInitialConfig,
} from "./utils";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";

export const Action = ({
  name,
  block,
  action_label,
  action_style,
  action_icon,
  action_size,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const btn = (
    <button
      className={`btn ${action_style || "btn-primary"} ${action_size || ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {action_icon ? <i className={`${action_icon} mr-1`}></i> : ""}
      {action_label || name}
    </button>
  );
  return selected ? <span className={"selected-node"}>{btn}</span> : btn;
};

export const ActionSettings = () => {
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
    action_style,
    action_size,
    action_icon,
  } = node;
  const options = useContext(optionsCtx);
  const getCfgFields = (fv) => (options.actionConfigForms || {})[fv];
  const cfgFields = getCfgFields(name);
  console.log({ action_icon });
  return (
    <div>
      <table className="w-100">
        <tr>
          <td>
            <label>Action</label>
          </td>
          <td>
            <select
              value={name}
              className="form-control"
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
            <OrFormula nodekey="action_label" {...{ setProp, isFormula, node }}>
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
        <tr>
          <td>
            <label>Action style</label>
          </td>
          <td>
            <select
              className="form-control"
              value={action_style}
              onChange={(e) =>
                setProp((prop) => (prop.action_style = e.target.value))
              }
            >
              <option value="btn-primary">Primary button</option>
              <option value="btn-secondary">Secondary button</option>
              <option value="btn-success">Success button</option>
              <option value="btn-danger">Danger button</option>
              <option value="btn-outline-primary">
                Primary outline button
              </option>
              <option value="btn-outline-secondary">
                Secondary outline button
              </option>
              <option value="btn-link">Link</option>
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label>Action size</label>
          </td>
          <td>
            {" "}
            <select
              className="form-control"
              value={action_size}
              onChange={(e) =>
                setProp((prop) => (prop.action_size = e.target.value))
              }
            >
              <option value="">Standard</option>
              <option value="btn-lg">Large</option>
              <option value="btn-sm">Small</option>
              <option value="btn-block">Block</option>
              <option value="btn-block btn-lg">Large block</option>
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label>Icon</label>
          </td>
          <td>
            <FontIconPicker
              value={action_icon}
              icons={faIcons}
              onChange={(value) =>
                setProp((prop) => (prop.action_icon = value))
              }
              isMulti={false}
            />
          </td>
        </tr><MinRoleSettingRow minRole={minRole} setProp={setProp} />
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

Action.craft = {
  displayName: "Action",
  related: {
    settings: ActionSettings,
  },
};
