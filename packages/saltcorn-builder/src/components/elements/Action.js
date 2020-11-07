import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, MinRoleSetting, OrFormula } from "./utils";

export const Action = ({ name, block, action_label }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const btn = (
    <button
      className={`btn btn-primary`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
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
  const cfgFields = options.actionConfigForms[name];
  return (
    <div>
      <div>
        <label>Action</label>

        <select
          value={name}
          onChange={(e) => setProp((prop) => (prop.name = e.target.value))}
        >
          {options.actions.map((f, ix) => (
            <option key={ix} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div>
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
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={confirm}
          onChange={(e) => setProp((prop) => (prop.confirm = e.target.checked))}
        />
        <label className="form-check-label">User confirmation?</label>
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <MinRoleSetting minRole={minRole} setProp={setProp} />
      {cfgFields ? (
        <ActionConfigForm
          fields={cfgFields}
          configuration={configuration}
          setProp={setProp}
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

const ActionConfigForm = ({ fields, configuration, setProp }) => (
  <Fragment>
    {fields.map((f, ix) => (
      <Fragment key={ix}>
        <label>{f.label || f.name}</label>
        <ActionConfigField
          field={f}
          configuration={configuration}
          setProp={setProp}
        />
      </Fragment>
    ))}
  </Fragment>
);
const ActionConfigField = ({ field, configuration, setProp }) =>
  ({
    String: () => (
      <input
        type="text"
        className="form-control"
        value={configuration[field.name]}
        onChange={(e) =>
          setProp((prop) => (prop.configuration[field.name] = e.target.value))
        }
      />
    ),
    textarea: () => (
      <textarea
        rows="6"
        type="text"
        className="form-control"
        value={configuration[field.name]}
        onChange={(e) =>
          setProp((prop) => (prop.configuration[field.name] = e.target.value))
        }
      />
    ),
  }[field.input_type || field.type.name || field.type]());
