import React from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const HTMLCode = ({ text }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return <span ref={dom => connect(drag(dom))}>{text}</span>;
};

export const HTMLCodeSettings = () => {
  const { setProp, text } = useNode(node => ({
    text: node.data.props.text
  }));
  return (
    <div>
      <label>HTML code</label>
      <textarea
        type="text"
        className="text-to-display"
        onChange={e => setProp(prop => (prop.text = e.target.value))}
      >
        {text}
      </textarea>
    </div>
  );
};

HTMLCode.craft = {
  related: {
    settings: HTMLCodeSettings
  }
};
