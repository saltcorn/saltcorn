import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";
import { blockProps, BlockSetting, TextStyleSetting } from "./utils";

export const Link = ({ text, block, textStyle }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={`${textStyle} is-builder-link ${
        selected ? "selected-node" : ""
      }`}
      {...blockProps(block)}
      ref={(dom) => connect(drag(dom))}
    >
      {text}
    </span>
  );
};
const OrFormula = ({ setProp, isFormula, value, key, children }) => (
  <Fragment>
    <div className="input-group  input-group-sm w-100">
      {children}
      <div className="input-group-append">
        <button
          className={`btn activate-formula ${
            isFormula[key] ? "btn-secondary" : "btn-outline-secondary"
          }`}
          title="Calculated formula"
          type="button"
          onClick={(e) =>
            setProp((prop) => (prop.isFormula[key] = !isFormula[key]))
          }
        >
          <i className="fas fa-calculator"></i>
        </button>
      </div>
    </div>
    {isFormula[key] && (
      <div style={{ marginTop: "-5px" }}>
        <small className="text-muted text-monospace">FORMULA</small>
      </div>
    )}
  </Fragment>
);
export const LinkSettings = () => {
  const {
    actions: { setProp },
    text,
    url,
    block,
    isFormula,
    textStyle,
  } = useNode((node) => ({
    text: node.data.props.text,
    url: node.data.props.url,
    block: node.data.props.block,
    isFormula: node.data.props.isFormula,
    textStyle: node.data.props.textStyle,
  }));
  return (
    <div>
      <label>Text to display</label>
      <OrFormula {...{ setProp, isFormula }} value={text} key="text">
        <input
          type="text"
          className="form-control text-to-display"
          value={text}
          onChange={(e) => setProp((prop) => (prop.text = e.target.value))}
        />
      </OrFormula>
      <label>URL</label>
      <input
        type="text"
        className="w-100"
        value={url}
        onChange={(e) => setProp((prop) => (prop.url = e.target.value))}
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
    isFormula: {},
    textStyle: "",
  },
  displayName: "Link",
  related: {
    settings: LinkSettings,
  },
};
