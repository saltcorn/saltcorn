/**
 * @category saltcorn-builder
 * @module components/elements/Action
 * @subcategory components / elements
 */
/*global notifyAlert*/

import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  BlockSetting,
  MinRoleSettingRow,
  OrFormula,
  ConfigForm,
  setInitialConfig,
  ButtonOrLinkSettingsRows,
  DynamicFontAwesomeIcon,
  setAPropGen,
  buildOptions,
  ConfigField,
} from "./utils";
import { ntimes } from "./Columns";

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
          : action_style === "on_page_load"
          ? {
              border: "1px red dashed",
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
    action_row_variable: node.data.props.action_row_variable,
    action_row_limit: node.data.props.action_row_limit,
    block: node.data.props.block,
    minRole: node.data.props.minRole,
    confirm: node.data.props.confirm,
    action_label: node.data.props.action_label,
    configuration: node.data.props.configuration,
    isFormula: node.data.props.isFormula,
    action_style: node.data.props.action_style,
    action_size: node.data.props.action_size,
    action_icon: node.data.props.action_icon,
    action_title: node.data.props.action_title,
    action_bgcol: node.data.props.action_bgcol,
    action_bordercol: node.data.props.action_bordercol,
    action_textcol: node.data.props.action_textcol,
    nsteps: node.data.props.nsteps,
    step_only_ifs: node.data.props.step_only_ifs,
    step_action_names: node.data.props.step_action_names,
    setting_action_n: node.data.props.setting_action_n,
    spinner: node.data.props.spinner,
  }));
  const {
    actions: { setProp },
    name,
    action_row_variable,
    action_row_limit,
    block,
    minRole,
    isFormula,
    confirm,
    configuration,
    action_label,
    action_title,
    action_style,
    nsteps,
    setting_action_n,
    step_only_ifs,
    step_action_names,
    spinner,
  } = node;
  const options = useContext(optionsCtx);
  const getCfgFields = (fv) => (options.actionConfigForms || {})[fv];
  const cfgFields = getCfgFields(name);
  const setAProp = setAPropGen(setProp);
  const use_setting_action_n =
    setting_action_n || setting_action_n === 0 ? setting_action_n : 0;
  const stepCfgFields =
    name === "Multi-step action"
      ? getCfgFields(step_action_names?.[use_setting_action_n])
      : null;
  const cfg_link = (options.triggerActions || []).includes(name)
    ? `/actions/configure/${encodeURIComponent(name)}`
    : name === "Multi-step action" &&
      (options.triggerActions || []).includes(
        step_action_names?.[use_setting_action_n]
      )
    ? `/actions/configure/${encodeURIComponent(
        step_action_names?.[use_setting_action_n]
      )}`
    : "";
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
                  if (!e.target) return;
                  const value = e.target.value;
                  setProp((prop) => {
                    prop.name = value;
                    if (options.mode === "filter" && value !== "Clear") {
                      const rowRequired =
                        options.actionConstraints &&
                        options.actionConstraints[value]?.requireRow;
                      if (!action_row_variable) {
                        prop.action_row_variable = rowRequired
                          ? "state"
                          : "none";
                      } else if (
                        rowRequired &&
                        action_row_variable === "none"
                      ) {
                        prop.action_row_variable = "state";
                      }
                    }
                    if (value === "Multi-step action" && !nsteps)
                      prop.nsteps = 1;
                    if (value === "Multi-step action" && !setting_action_n)
                      prop.setting_action_n = 0;
                    if (value === "Multi-step action" && !configuration.steps)
                      prop.configuration = { steps: [] };
                  });
                  setInitialConfig(setProp, value, getCfgFields(value));
                }}
              >
                {options.actions.map((f, ix) =>
                  f.optgroup && !f.options.length ? null : f.optgroup ? (
                    <optgroup key={ix} label={f.label}>
                      {f.options.map((a, jx) => (
                        <option key={jx} value={a}>
                          {a}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={ix} value={f}>
                      {f}
                    </option>
                  )
                )}
              </select>
            </td>
          </tr>
          {name !== "Clear" && options.mode === "filter" ? (
            <tr>
              <td>
                <label>Row variable</label>
              </td>
              <td>
                <select
                  value={action_row_variable}
                  className="form-control form-select"
                  onChange={(e) => {
                    if (!e.target) return;
                    const value = e.target.value;
                    const rowRequired =
                      options.actionConstraints &&
                      options.actionConstraints[name]?.requireRow;
                    if (value === "none" && rowRequired) {
                      notifyAlert({
                        type: "warning",
                        text: `${name} requires a row, none is not possible`,
                      });
                    } else
                      setProp((prop) => (prop.action_row_variable = value));
                    setInitialConfig(setProp, value, getCfgFields(value));
                  }}
                >
                  {buildOptions(["none", "state", "each_matching_row"], {
                    valAttr: true,
                    keyAttr: true,
                  })}
                </select>
              </td>
            </tr>
          ) : null}
          {action_row_variable === "each_matching_row" ? (
            <tr>
              <td>
                <label>Rows limit</label>
              </td>
              <td>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  value={action_row_limit}
                  onChange={setAProp("action_row_limit")}
                />
              </td>
            </tr>
          ) : null}
          {action_style !== "on_page_load" ? (
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
                    onChange={setAProp("action_label")}
                  />
                </OrFormula>
              </td>
            </tr>
          ) : null}
          <ButtonOrLinkSettingsRows
            setProp={setProp}
            keyPrefix="action_"
            values={node}
            allowRunOnLoad={true}
          />
          <MinRoleSettingRow minRole={minRole} setProp={setProp} />
        </tbody>
      </table>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={confirm}
          onChange={setAProp("confirm", { checked: true })}
        />
        <label className="form-check-label">User confirmation?</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={spinner}
          onChange={setAProp("spinner", { checked: true })}
        />
        <label className="form-check-label">Spinner on click</label>
      </div>
      {action_style !== "on_page_load" ? (
        <BlockSetting block={block} setProp={setProp} />
      ) : null}
      {name === "Multi-step action" ? (
        <Fragment>
          <table className="mb-2">
            <tbody>
              <tr>
                <td className="w-50">
                  <label>#Steps</label>
                </td>
                <td>
                  <input
                    type="number"
                    value={nsteps}
                    className="form-control d-inline"
                    step="1"
                    min="1"
                    onChange={(e) => {
                      if (!e.target) return;
                      const value = e.target.value;
                      setProp((prop) => {
                        prop.nsteps = value;
                      });
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <ConfigField
            field={{
              name: "setting_action_n",
              label: "Column number",
              type: "btn_select",
              options: ntimes(nsteps, (i) => ({
                value: i,
                title: `${i + 1}`,
                label: `${i + 1}`,
              })),
            }}
            node={node}
            setProp={setProp}
            props={node}
          ></ConfigField>
          <label>Action</label>
          <select
            value={step_action_names?.[use_setting_action_n] || ""}
            className="form-control form-select"
            onChange={(e) => {
              if (!e.target) return;
              const value = e.target.value;
              setProp((prop) => {
                if (!prop.step_action_names) prop.step_action_names = [];
                prop.step_action_names[use_setting_action_n] = value;
              });
            }}
          >
            <option value="" disabled>
              Select action...
            </option>
            {options.actions
              .filter((f) => !(options.builtInActions || []).includes(f))
              .map((f, ix) =>
                f.optgroup ? (
                  <optgroup key={ix} label={f.label}>
                    {f.options
                      .filter(
                        (f) =>
                          ![
                            "Multi-step action",
                            ...(options.builtInActions || []),
                          ].includes(f)
                      )
                      .map((a, jx) => (
                        <option key={jx} value={a}>
                          {a}
                        </option>
                      ))}
                  </optgroup>
                ) : (
                  <option key={ix} value={f}>
                    {f}
                  </option>
                )
              )}
          </select>
          {options.mode !== "page" ? (
            <Fragment>
              <label>Only if... (formula)</label>
              <input
                type="text"
                className="form-control text-to-display"
                value={step_only_ifs?.[use_setting_action_n] || ""}
                onChange={(e) => {
                  if (!e.target) return;
                  const value = e.target.value;
                  setProp((prop) => {
                    if (!prop.step_only_ifs) prop.step_only_ifs = [];
                    prop.step_only_ifs[use_setting_action_n] = value;
                  });
                }}
              />
            </Fragment>
          ) : null}
          {stepCfgFields ? (
            <Fragment>
              Step configuration:
              <ConfigForm
                fields={stepCfgFields}
                configuration={
                  configuration?.steps?.[use_setting_action_n] || {}
                }
                setProp={setProp}
                setter={(prop, fldname, v) => {
                  if (!prop.configuration.steps) prop.configuration.steps = [];
                  if (!prop.configuration.steps[use_setting_action_n])
                    prop.configuration.steps[use_setting_action_n] = {};
                  prop.configuration.steps[use_setting_action_n][fldname] = v;
                }}
                node={node}
              />
            </Fragment>
          ) : null}
        </Fragment>
      ) : cfgFields ? (
        <ConfigForm
          fields={cfgFields}
          configuration={configuration}
          setProp={setProp}
          node={node}
        />
      ) : null}
      {cfg_link ? (
        <a className="d-block mt-2" target="_blank" href={cfg_link}>
          Configure this action
        </a>
      ) : null}
    </div>
  );
};

/**
 * @type {object}
 */
Action.craft = {
  displayName: "Action",
  defaultProps: { setting_action_n: 0, nsteps: 1 },
  related: {
    settings: ActionSettings,
  },
};
