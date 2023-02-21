/**
 * @category saltcorn-builder
 * @module components/elements/DropDownFilter
 * @subcategory components / elements
 */

import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow, setAPropGen } from "./utils";

export /**
 * @param {object} props
 * @param {string} props.name
 * @param {boolean} props.block
 * @param {boolean} props.full_width
 * @returns {span}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const DropDownFilter = ({ name, block, full_width }) => {
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
      <select disabled={true} className={full_width ? "w-100" : ""}>
        <option>{name}</option>
      </select>
    </span>
  );
};

export /**
 * @returns {table}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const DropDownFilterSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
    neutral_label,
    label_formula,
    full_width,
    where,
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    neutral_label: node.data.props.neutral_label,
    full_width: node.data.props.full_width,
    label_formula: node.data.props.label_formula,
    where: node.data.props.where,
  }));
  const options = useContext(optionsCtx);
  const setAProp = setAPropGen(setProp);

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
              onChange={setAProp("name")}
            >
              {options.fields.map((f, ix) => (
                <option key={ix} value={f.name}>
                  {f.label}
                </option>
              ))}
              {options.parent_field_list.map((f, ix) => (
                <option key={ix} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </td>
        </tr>
        <tr>
          <td>
            <label>Neutral label</label>
          </td>
          <td>
            <input
              value={neutral_label}
              className="form-control"
              onChange={setAProp("neutral_label")}
            />
          </td>
        </tr>
        <tr>
          <td>
            <label>Where</label>
          </td>
          <td>
            <input
              value={where}
              className="form-control"
              onChange={setAProp("where")}
            />
          </td>
        </tr>
        <tr>
          <td>
            <label>Label formula</label>
          </td>
          <td>
            <input
              value={label_formula}
              className="form-control"
              onChange={setAProp("label_formula")}
            />
            <i>
              In scope: <code>{name}</code>
            </i>
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <BlockSetting block={block} setProp={setProp} />
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <div className="form-check">
              <input
                className="form-check-input"
                name="block"
                type="checkbox"
                checked={full_width}
                onChange={setAProp("full_width", { checked: true })}
              />
              <label className="form-check-label">Full width</label>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

/**
 * @type {object}
 */
DropDownFilter.craft = {
  displayName: "DropDownFilter",
  related: {
    settings: DropDownFilterSettings,
    segment_type: "dropdown_filter",
    column_type: "DropDownFilter",
    fields: [
      { name: "name", segment_name: "field_name", column_name: "field_name" },
      "full_width",
      "neutral_label",
      "label_formula",
      "where",
      "block",
    ],
  },
};
