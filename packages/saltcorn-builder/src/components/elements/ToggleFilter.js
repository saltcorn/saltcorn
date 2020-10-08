import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow } from "./utils";

export const ToggleFilter = ({ name, value, block, label }) => {
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
      <button className="btn btn-outline-primary">
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
  } = useNode((node) => ({
    name: node.data.props.name,
    value: node.data.props.value,
    block: node.data.props.block,
    label: node.data.props.label,
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
