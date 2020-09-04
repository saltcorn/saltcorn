import React, { useState, useEffect } from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";
import ContentEditable from "react-contenteditable";

export const Text = ({ text, block, textStyle }) => {
  const {
    connectors: { connect, drag },
    selected,
    actions: { setProp },
  } = useNode((state) => ({
    selected: state.events.selected,
    dragged: state.events.dragged,
  }));
  const [editable, setEditable] = useState(false);

  useEffect(() => {
    !selected && setEditable(false);
  }, [selected]);

  return (
    <span
      className={`${textStyle} is-text`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
      onClick={(e) => selected && setEditable(true)}
    >
      <ContentEditable
        html={text}
        style={{ display: "inline" }}
        disabled={!editable}
        onChange={(e) => setProp((props) => (props.text = e.target.value))}
      />
    </span>
  );
};

export const TextSettings = () => {
  const {
    actions: { setProp },
    text,
    block,
    textStyle,
  } = useNode((node) => ({
    text: node.data.props.text,
    block: node.data.props.block,
    textStyle: node.data.props.textStyle,
  }));
  return (
    <div>
      <label>Text to display</label>
      <input
        type="text"
        className="text-to-display w-100"
        value={text}
        onChange={(e) => setProp((prop) => (prop.text = e.target.value))}
      />
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

Text.craft = {
  related: {
    settings: TextSettings,
  },
};
