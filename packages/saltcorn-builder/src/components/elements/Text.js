import React from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const Text = ({ text, block, textStyle }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <span
      className={textStyle}
      {...blockProps(block)}
      ref={dom => connect(drag(dom))}
    >
      {text}
    </span>
  );
};

export const TextSettings = () => {
  const { setProp, text, block, textStyle } = useNode(node => ({
    text: node.data.props.text,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle
  }));
  return (
    <div>
      <h6>Text settings</h6>
      <input
        type="text"
        value={text}
        onChange={e => setProp(prop => (prop.text = e.target.value))}
      />
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

Text.craft = {
  related: {
    settings: TextSettings
  }
};
