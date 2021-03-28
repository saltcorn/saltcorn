import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow } from "./utils";

export const ToggleFilter = ({ name, value, block, label, size }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={selected ? "selected-node" : ""}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      <button className={`btn btn-outline-primary ${size}`}>
        {label || value || "Set label"}
      </button>
    </span>
  );
};

export const ToggleFilterSettings = () => {
  const {
    actions: { setProp },
    name,
    value,
    block,
    label,
    size
  } = useNode((node) => ({
    name: node.data.props.name,
    value: node.data.props.value,
    block: node.data.props.block,
    label: node.data.props.label,
    size: node.data.props.size,
  }));
  const options = useContext(optionsCtx);
  const field = options.fields.find((f) => f.name === name);
  const isBool = field && field.type.name === "Bool";
  return (
    <table className="w-100">
      <tbody>
        <tr>
          <td>
            <label>Field</label>
          </td>
          <td>
            <select
              value={name}
              className="form-control"
              onChange={(e) => {
                setProp((prop) => (prop.name = e.target.value));
                const field = options.fields.find(
                  (f) => f.name === e.target.value
                );
                const isBool = field && field.type.name === "Bool";
                if (isBool) setProp((prop) => (prop.value = "on"));
              }}
            >
              {options.fields.map((f, ix) => (
                <option key={ix} value={f.name}>
                  {f.label}
                </option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label>Value</label>
          </td>
          <td>
            {isBool ? (
              <select
                value={value}
                className="w-100"
                onChange={(e) =>
                  setProp((prop) => (prop.value = e.target.value))
                }
              >
                <option value="on">True</option>
                <option value="off">False</option>
                <option value="?">Both</option>
              </select>
            ) : (
              <input
                value={value}
                className="w-100"
                onChange={(e) =>
                  setProp((prop) => (prop.value = e.target.value))
                }
              />
            )}
          </td>
        </tr>
        <tr>
          <td>
            <label>Label</label>
          </td>
          <td>
            <input
              value={label}
              className="w-100"
              onChange={(e) => setProp((prop) => (prop.label = e.target.value))}
            />
          </td>
        </tr>
        <tr>
          <td>
            <label>Button size</label>
          </td>
          <td>
            {" "}
            <select
              className="form-control"
              value={size}
              onChange={(e) =>
                setProp((prop) => (prop.size = e.target.value))
              }
            >
              <option value="">Standard</option>
              <option value="btn-lg">Large</option>
              <option value="btn-sm">Small</option>
              <option value="btn-block">Block</option>
              <option value="btn-block btn-lg">Large block</option>
              <option value="btn-block btn-sm">Small block</option>
            </select>
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <BlockSetting block={block} setProp={setProp} />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

ToggleFilter.craft = {
  displayName: "ToggleFilter",
  related: {
    settings: ToggleFilterSettings,
  },
};
