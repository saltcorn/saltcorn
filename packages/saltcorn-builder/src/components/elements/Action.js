/**
 * @category saltcorn-builder
 * @module components/elements/Action
 * @subcategory components / elements
 */
/*global notifyAlert, apply_showif*/

import React, { Fragment, useContext, useEffect, useState } from "react";
import { useNode } from "@craftjs/core";
import useTranslation from "../../hooks/useTranslation";
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
  reactSelectStyles,
  builderSelectClassName,
} from "./utils";
import { ntimes } from "./Columns";
import { ArrayManager } from "./ArrayManager";
import { MultiLineCodeEditor } from "./MonacoEditor";
import Select from "react-select";

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
 * @category saltcorn-builder * @subcategory components
 * @namespace
 * @returns {div}
 */
const ActionSettings = () => {
  const { t } = useTranslation();
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
    action_class: node.data.props.action_class,
    nsteps: node.data.props.nsteps,
    step_only_ifs: node.data.props.step_only_ifs,
    step_action_names: node.data.props.step_action_names,
    setting_action_n: node.data.props.setting_action_n,
    spinner: node.data.props.spinner,
    run_async: node.data.props.run_async,
    is_submit_action: node.data.props.is_submit_action,
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
    run_async,
    is_submit_action,
  } = node;
  const options = useContext(optionsCtx);
  const getCfgFields = (fv) => (options.actionConfigForms || {})[fv];
  const cfgFields = getCfgFields(name);
  const cfgFieldsForForm =
    name === "run_js_code"
      ? (cfgFields || []).filter((f) => f.name !== "code")
      : cfgFields;

  const runJsCodeModalOnly = false;
  const [codeModalOpen, setCodeModalOpen] = useState(false);
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
  const setAction = (value0) => {
    const value = value0.value || value0;
    setProp((prop) => {
      prop.name = value;
      if (options.mode === "filter" && value !== "Clear") {
        const rowRequired =
          options.actionConstraints &&
          options.actionConstraints[value]?.requireRow;
        if (!action_row_variable) {
          prop.action_row_variable = rowRequired ? "state" : "none";
        } else if (rowRequired && action_row_variable === "none") {
          prop.action_row_variable = "state";
        }
      }
      if (value === "Multi-step action" && !nsteps) prop.nsteps = 1;
      if (value === "Multi-step action" && !setting_action_n)
        prop.setting_action_n = 0;
      if (value === "Multi-step action" && !configuration.steps)
        prop.configuration = { steps: [] };
    });
    setInitialConfig(setProp, value, getCfgFields(value));
  };
  const setMultistepAction = (value0) => {
    const value = value0.value || value0;
    setProp((prop) => {
      if (!prop.step_action_names) prop.step_action_names = [];
      prop.step_action_names[use_setting_action_n] = value;
    });
  };
  const actionOptions = options.actions.filter(Boolean).map((f, ix) =>
    f.optgroup && !f.options.length
      ? null
      : f.optgroup
        ? {
            label: f.label,
            options: f.options.map((a, jx) => ({ label: a, value: a })),
          }
        : { label: f, value: f }
  );
  const selectedAction = { label: name, value: name };
  const multiStepActionOptions = options.actions
    .filter((f) => f && !(options.builtInActions || []).includes(f))
    .map((f, ix) =>
      f.optgroup && !f.options.length
        ? null
        : f.optgroup
          ? {
              label: f.label,
              options: f.options
                .filter(
                  (f) =>
                    ![
                      "Multi-step action",
                      ...(options.builtInActions || []),
                    ].includes(f)
                )
                .map((a, jx) => ({ label: a, value: a })),
            }
          : { label: f, value: f }
    );
  const selectedMultiStepAction = {
    label: step_action_names?.[use_setting_action_n] || "",
    value: step_action_names?.[use_setting_action_n] || "",
  };
  useEffect(() => {
    apply_showif();
  }, [
    name,
    step_action_names?.[use_setting_action_n] || "",
    JSON.stringify(configuration?.steps?.[use_setting_action_n]),
  ]);
  

  return (
    <div>
      <table className="w-100">
        <tbody>
          <tr>
            <td>
              <label>{t("Action")}</label>
            </td>
            <td>
              {options.inJestTestingMode ? null : (
                <Select
                  options={actionOptions}
                  className={builderSelectClassName("react-select action-selector")}
                  classNamePrefix="builder-select"
                  value={selectedAction}
                  defaultValue={selectedAction}
                  onChange={setAction}
                  menuPortalTarget={document.body}
                  styles={reactSelectStyles()}
                ></Select>
              )}
            </td>
          </tr>
          {name !== "Clear" && options.mode === "filter" ? (
            <tr>
              <td>
                <label>{t("Row variable")}</label>
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
                <label>{t("Rows limit")}</label>
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
                <label>{t("Label (leave blank for default)")}</label>
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
            faIcons={options.icons}
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
        <label className="form-check-label">{t("User confirmation?")}</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={spinner}
          onChange={setAProp("spinner", { checked: true })}
        />
        <label className="form-check-label">{t("Spinner on click")}</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={run_async}
          onChange={setAProp("run_async", { checked: true })}
        />
        <label className="form-check-label">{t("Run async")}</label>
      </div>
      {action_style !== "on_page_load" ? (
        <BlockSetting block={block} setProp={setProp} />
      ) : null}
      {options.mode === "edit" && name !== "Save" ? (
        <div className="form-check">
          <input
            className="form-check-input"
            name="block"
            type="checkbox"
            checked={is_submit_action}
            onChange={setAProp("is_submit_action", { checked: true })}
          />
          <label className="form-check-label">{t("This is the submit action")}</label>
        </div>
      ) : null}
      {name === "Multi-step action" ? (
        <Fragment>
          <label>{t("Steps")}</label>

          <ArrayManager
            node={node}
            setProp={setProp}
            countProp={"nsteps"}
            currentProp={"setting_action_n"}
            managedArrays={[
              "step_action_names",
              "step_only_ifs",
              "configuration.steps",
            ]}
          ></ArrayManager>

          <label>{t("Action")}</label>
          {options.inJestTestingMode ? null : (
            <Select
              options={multiStepActionOptions}
              className={builderSelectClassName("react-select multistep-action-selector")}
              classNamePrefix="builder-select"
              value={selectedMultiStepAction}
              defaultValue={selectedMultiStepAction}
              onChange={setMultistepAction}
              menuPortalTarget={document.body}
              styles={reactSelectStyles()}
            ></Select>
          )}
          {options.mode !== "page" ? (
            <Fragment>
              <label>{t("Only if... (formula)")}</label>
              <input
                type="text"
                className="form-control text-to-display"
                value={step_only_ifs?.[use_setting_action_n] || ""}
                spellCheck={false}
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
              {t("Step configuration:")}
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
        <Fragment>
          {name === "run_js_code" && runJsCodeModalOnly ? (
            <div className="builder-config-field" data-field-name="code">
              <label>{t("Code")}</label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCodeModalOpen(true)}
              >
                {t("Open Code Popup")}
              </button>
            </div>
          ) : null}
          {name === "run_js_code" && !runJsCodeModalOnly ? (
            <Fragment>
              <ConfigForm
                fields={(cfgFields || []).filter((f) => f.name === "code")}
                configuration={configuration}
                setProp={setProp}
                node={node}
                openPopup={() => setCodeModalOpen(true)}
              />
              {/* <div className="builder-config-field mt-2" data-field-name="code-modal-trigger">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCodeModalOpen(true)}
                >
                  {t("Open Code Popup")}
                </button>
              </div> */}
              <ConfigForm
                fields={cfgFieldsForForm}
                configuration={configuration}
                setProp={setProp}
                node={node}
              />
            </Fragment>
          ) : (
            <ConfigForm
              fields={runJsCodeModalOnly ? cfgFieldsForForm : cfgFields}
              configuration={configuration}
              setProp={setProp}
              node={node}
            />
          )}
          {name === "run_js_code" && codeModalOpen ? (
                <div
                  className={`modal fade ${codeModalOpen ? "show" : ""}`}
                  style={{
                    display: codeModalOpen ? "block" : "none",
                    zIndex: 1055,
                  }}
                  tabIndex={-1}
                  role="dialog"
                  aria-labelledby="codeModalLabel"
                  aria-hidden={!codeModalOpen}
                >
                  <div
                    className="modal-backdrop fade show"
                    style={{ zIndex: 1050 }}
                    onClick={() => setCodeModalOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="modal-dialog modal-dialog-centered modal-lg"
                    role="document"
                    style={{ zIndex: 1060 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="modal-content code-modal">
                      <div className="modal-header">
                        <h5 className="modal-title" id="codeModalLabel">
                          {t("Code")}
                        </h5>
                        <button
                          type="button"
                          className="btn-close"
                          aria-label="Close"
                          onClick={() => setCodeModalOpen(false)}
                        />
                      </div>
                      <div className="modal-body">
                        <MultiLineCodeEditor
                          setProp={setProp}
                          value={configuration?.code ?? ""}
                          onChange={(code) =>
                            setProp((prop) => {
                              if (!prop.configuration)
                                prop.configuration = {};
                              prop.configuration.code = code;
                            })
                          }
                          isModalEditor
                        />
                      </div>
                      <div className="modal-footer">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setCodeModalOpen(false)}
                        >
                          {t("Close")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
        </Fragment>
      ) : null}
      {cfg_link ? (
        <a className="d-block mt-2" target="_blank" href={cfg_link}>
          {t("Configure this action")}
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
