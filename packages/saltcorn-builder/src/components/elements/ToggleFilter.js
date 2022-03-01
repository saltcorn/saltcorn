/**
 * @category saltcorn-builder
 * @module components/elements/ToggleFilter
 * @subcategory components / elements
 */

import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow } from "./utils";

export /**
 * @param {object} props
 * @param {*} props.name
 * @param {string} [props.value]
 * @param {string} [props.preset_value]
 * @param {boolean} props.block
 * @param {string} [props.label]
 * @param {string} props.size
 * @param {string} props.style
 * @returns {table}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const ToggleFilter = ({
  name,
  value,
  preset_value,
  block,
  label,
  size,
  style,
}) => {
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
      <button className={`btn btn-outline-${style || "primary"} ${size}`}>
        {label || value || preset_value || "Set label"}
      </button>
    </span>
  );
};

export /**
 * @returns {table}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const ToggleFilterSettings = () => {
  const {
    actions: { setProp },
    name,
    value,
    block,
    preset_value,
    label,
    size,
    style,
  } = useNode((node) => ({
    name: node.data.props.name,
    value: node.data.props.value,
    preset_value: node.data.props.preset_value,
    block: node.data.props.block,
    label: node.data.props.label,
    size: node.data.props.size,
    style: node.data.props.style,
  }));
  const options = useContext(optionsCtx);
  const field = options.fields.find((f) => f.name === name);
  const preset_options = field.preset_options;
  const isBool = field && field.type.name === "Bool";
  const setAProp = (key) => (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop[key] = target_value));
    }
  };
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
              className="form-control form-select"
              onChange={(e) => {
                setProp((prop) => (prop.name = e.target.value));
                const field = options.fields.find(
                  (f) => f.name === e.target.value
                );
                const isBool = field && field.type.name === "Bool";
                if (isBool) setProp((prop) => (prop.value = "on"));
                setProp((prop) => (prop.preset_value = ""));
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
                className="w-100 form-select"
                onChange={setAProp("value")}
              >
                <option value="on">True</option>
                <option value="off">False</option>
                <option value="?">Both</option>
              </select>
            ) : (
              <input
                value={value}
                className="w-100"
                onChange={setAProp("value")}
              />
            )}
          </td>
        </tr>
        {preset_options && preset_options.length > 0 ? (
          <tr>
            <td>
              <label>Preset</label>
            </td>
            <td>
              <select
                value={preset_value}
                className="form-control form-select"
                onChange={setAProp("preset_value")}
              >
                <option value=""></option>
                {preset_options.map((po, ix) => (
                  <option key={ix} value={po}>
                    {po}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        ) : null}
        <tr>
          <td>
            <label>Label</label>
          </td>
          <td>
            <input
              value={label}
              className="w-100"
              onChange={setAProp("label")}
            />
          </td>
        </tr>
        <tr>
          <td>
            <label>Button size</label>
          </td>
          <td>
            <select
              className="form-control form-select"
              value={size}
              onChange={setAProp("size")}
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
          <td>
            <label>Button style</label>
          </td>
          <td>
            <select
              className="form-control form-select"
              value={style}
              onChange={setAProp("style")}
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="success">Success</option>
              <option value="danger">Danger</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
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

/**
 * @type {object}
 */
ToggleFilter.craft = {
  displayName: "ToggleFilter",
  related: {
    settings: ToggleFilterSettings,
    segment_type: "toggle_filter",
    column_type: "ToggleFilter",
    fields: [
      { name: "name", segment_name: "field_name", column_name: "field_name" },
      "value",
      "preset_value",
      "block",
      "label",
      "size",
      "style",
    ],
  },
};
