import React, { Fragment, useContext } from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting, OrFormula } from "./utils";
import optionsCtx from "../context";

export const Link = ({ text, block, isFormula, textStyle }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={`${textStyle} is-builder-link ${
        selected ? "selected-node" : ""
      } ${isFormula.text ? "text-monospace" : ""}`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {isFormula.text ? `=${text}` : text}
    </span>
  );
};

export const LinkSettings = () => {
  const node = useNode((node) => ({
    text: node.data.props.text,
    url: node.data.props.url,
    block: node.data.props.block,
    isFormula: node.data.props.isFormula,
    textStyle: node.data.props.textStyle,
    nofollow: node.data.props.nofollow,
    target_blank: node.data.props.target_blank,
  }));
  const {
    actions: { setProp },
    text,
    url,
    block,
    isFormula,
    textStyle,
    nofollow,
    target_blank,
  } = node;

  return (
    <div>
      <label>Text to display</label>
      <OrFormula nodekey="text" {...{ setProp, isFormula, node }}>
        <input
          type="text"
          className="form-control text-to-display"
          value={text}
          onChange={(e) => setProp((prop) => (prop.text = e.target.value))}
        />
      </OrFormula>
      <label>URL</label>
      <OrFormula nodekey="url" {...{ setProp, isFormula, node }}>
        <input
          type="text"
          className="form-control "
          value={url}
          onChange={(e) => setProp((prop) => (prop.url = e.target.value))}
        />
      </OrFormula>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={nofollow}
          onChange={(e) =>
            setProp((prop) => (prop.nofollow = e.target.checked))
          }
        />
        <label className="form-check-label">Nofollow</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={target_blank}
          onChange={(e) =>
            setProp((prop) => (prop.target_blank = e.target.checked))
          }
        />
        <label className="form-check-label">Open in new tab</label>
      </div>
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
    nofollow: false,
    target_blank: false,
    isFormula: {},
    textStyle: "",
  },
  displayName: "Link",
  related: {
    settings: LinkSettings,
  },
};
