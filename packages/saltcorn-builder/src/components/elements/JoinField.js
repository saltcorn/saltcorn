import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const JoinField = ({ name, block, textStyle }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={`${textStyle} ${selected ? "selected-node" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      [{name}]
    </span>
  );
};

export const JoinFieldSettings = () => {
  const {
    actions: { setProp },
    name,
    block,
    textStyle,
  } = useNode((node) => ({
    name: node.data.props.name,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle,
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>Join field</label>

        <select
          value={name}
          onChange={(e) => setProp((prop) => (prop.name = e.target.value))}
        >
          {options.parent_field_list.map((f, ix) => (
            <option key={ix} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

JoinField.craft = {
  displayName: "JoinField",
  related: {
    settings: JoinFieldSettings,
  },
};
