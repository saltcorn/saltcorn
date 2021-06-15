import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow } from "./utils";

export const DropDownFilter = ({ name, block, full_width }) => {
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

export const DropDownFilterSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
    neutral_label,
    full_width,
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    neutral_label: node.data.props.neutral_label,
    full_width: node.data.props.full_width,
  }));
  const options = useContext(optionsCtx);
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
              onChange={(e) => setProp((prop) => (prop.name = e.target.value))}
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
            <label>Neutral label</label>
          </td>
          <td>
            <input
              value={neutral_label}
              className="form-control"
              onChange={(e) =>
                setProp((prop) => (prop.neutral_label = e.target.value))
              }
            />
          </td>
        </tr>
        <tr>
          <td></td>
          <td>
            <BlockSetting block={block} setProp={setProp} />
          </td>
        </tr>{" "}
        <tr>
          <td></td>
          <td>
            <div className="form-check">
              <input
                className="form-check-input"
                name="block"
                type="checkbox"
                checked={full_width}
                onChange={(e) =>
                  setProp((prop) => (prop.full_width = e.target.checked))
                }
              />
              <label className="form-check-label">Full width</label>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
};

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
      "block",
    ],
  },
};
