import React, { useContext, Fragment } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleRow } from "./utils";

export const DropDownFilter = ({ name, block }) => {
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
      <select disabled={true}>
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
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    neutral_label: node.data.props.neutral_label,
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
        </tr>
      </tbody>
    </table>
  );
};

DropDownFilter.craft = {
  displayName: "DropDownFilter",
  related: {
    settings: DropDownFilterSettings,
  },
};
