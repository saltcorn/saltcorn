import React from "react";
import { useNode } from "@craftjs/core";
import { blockProps } from "./utils";

export const Text = ({ text, block }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <span {...blockProps(block)} ref={dom => connect(drag(dom))}>
      {text}
    </span>
  );
};

export const TextSettings = () => {
  const { setProp, text, block } = useNode(node => ({
    text: node.data.props.text,
    block: node.data.props.block
  }));
  return (
    <div>
      <h6>Text settings</h6>
      <input
        type="text"
        value={text}
        onChange={e => setProp(prop => (prop.text = e.target.value))}
      />
      <label>
        Block
        <input
          name="block"
          type="checkbox"
          checked={block}
          onChange={e => setProp(prop => (prop.block = e.target.checked))}
        />
      </label>
    </div>
  );
};

Text.craft = {
  related: {
    settings: TextSettings
  }
};
