import React from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const Link = ({ text, block, textStyle }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <span
      className={`${textStyle} is-builder-link`}
      {...blockProps(block)}
      ref={dom => connect(drag(dom))}
    >
      {text}
    </span>
  );
};

export const LinkSettings = () => {
  const { setProp, text, url, block, textStyle } = useNode(node => ({
    text: node.data.props.text,
    url: node.data.props.url,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle
  }));
  return (
    <div>
      <label>Text to display</label>
      <input
        type="text"
        className="text-to-display"
        value={text}
        onChange={e => setProp(prop => (prop.text = e.target.value))}
      />
      <label>URL</label>
      <input
        type="text"
        value={url}
        onChange={e => setProp(prop => (prop.url = e.target.value))}
      />
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

Link.craft = {
  defaultProps: {
    text: "Click here",
    url: "https://saltcorn.com/",
    block: false,
    textStyle: ""
  },
  related: {
    settings: LinkSettings
  }
};
