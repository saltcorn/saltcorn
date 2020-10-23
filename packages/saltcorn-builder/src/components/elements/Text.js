import React, { useState, useEffect } from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting, OrFormula } from "./utils";
import ContentEditable from "react-contenteditable";

export const Text = ({ text, block, isFormula, textStyle }) => {
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
      className={`${textStyle} is-text ${
        isFormula.text ? "text-monospace" : ""
      } ${selected ? "selected-node" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
      onClick={(e) => selected && setEditable(true)}
    >
      {isFormula.text && "="}
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
  const node = useNode((node) => ({
    text: node.data.props.text,
    block: node.data.props.block,
    isFormula: node.data.props.isFormula,
    textStyle: node.data.props.textStyle,
  }));
  const {
    actions: { setProp },
    text,
    block,
    textStyle,
    isFormula,
  } = node;
  return (
    <div>
      <label>Text to display</label>
      <OrFormula nodekey="text" {...{ setProp, isFormula, node }}>
        <input
          type="text"
          className="text-to-display form-control"
          value={text}
          onChange={(e) => setProp((prop) => (prop.text = e.target.value))}
        />
      </OrFormula>
      <BlockSetting block={block} setProp={setProp} />
      <TextStyleSetting textStyle={textStyle} setProp={setProp} />
    </div>
  );
};

Text.craft = {
  defaultProps: {
    text: "Click here",
    block: false,
    isFormula: {},
    textStyle: "",
  },
  displayName: "Text",
  related: {
    settings: TextSettings,
  },
};
