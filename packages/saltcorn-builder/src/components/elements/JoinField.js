import React, { useContext } from "react";
import { useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const JoinField = ({ name, block, textStyle }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <span
      className={textStyle}
      {...blockProps(block)}
      ref={dom => connect(drag(dom))}
    >
      [{name}]
    </span>
  );
};

export const JoinFieldSettings = () => {
  const { setProp, name, block, textStyle } = useNode(node => ({
    name: node.data.props.name,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle
  }));
  const options = useContext(optionsCtx);
  return (
    <div>
      <div>
        <label>Join field</label>

        <select
          value={name}
          onChange={e => setProp(prop => (prop.name = e.target.value))}
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
  related: {
    settings: JoinFieldSettings
  }
};
