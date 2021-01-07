import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow } from "./utils";

export const ClearFilter = ({ block, label, btn_style, btn_size }) => {
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
      <button className={`btn ${btn_style || "btn-primary"} ${btn_size || ""}`}>
        {label || "Clear"}
      </button>
    </span>
  );
};

export const ClearFilterSettings = () => {
  const {
    actions: { setProp },
    block,
    label,
    btn_style,
    btn_size,
  } = useNode((node) => ({
    label: node.data.props.label,
    block: node.data.props.block,
    btn_style: node.data.props.btn_style,
    btn_size: node.data.props.btn_size,
  }));

  return (
    <table className="w-100">
      <tbody>
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
            <label>Button style</label>
          </td>
          <td>
            <select
              className="w-100 mr-2"
              value={btn_style}
              onChange={(e) =>
                setProp((prop) => (prop.btn_style = e.target.value))
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
            <label>Button size</label>
          </td>
          <td>
            {" "}
            <select
              className="w-100 mr-2"
              value={btn_size}
              onChange={(e) =>
                setProp((prop) => (prop.btn_size = e.target.value))
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
          <td></td>
          <td>
            <BlockSetting block={block} setProp={setProp} />
          </td>
        </tr>
      </tbody>
    </table>
  );
};

ClearFilter.craft = {
  displayName: "ClearFilter",
  related: {
    settings: ClearFilterSettings,
  },
};
