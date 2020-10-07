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
      <select>
        <option>Any</option>
        <option>Anne</option>
        <option>Ben</option>
        <option>Carol</option>
        <option>...</option>
      </select>
    </span>
  );
};

export const DropDownFilterSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
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
