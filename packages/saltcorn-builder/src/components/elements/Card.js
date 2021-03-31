import React, { Fragment } from "react";
import { Text } from "./Text";
import { OrFormula } from "./utils";

import { Element, useNode } from "@craftjs/core";

export const Card = ({ children, isFormula, title, shadow }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));

  return (
    <div
      className={`card ${shadow ? "shadow" : ""} builder ${
        selected ? "selected-node" : ""
      }`}
      ref={(dom) => connect(drag(dom))}
    >
      {title && title.length > 0 && (
        <div className="card-header">
          {isFormula.title ? (
            <span className="text-monospace">={title}</span>
          ) : (
            title
          )}
        </div>
      )}
      <div className="card-body canvas">{children}</div>
    </div>
  );
};

export const CardSettings = () => {
  const node = useNode((node) => ({
    title: node.data.props.title,
    isFormula: node.data.props.isFormula,
    url: node.data.props.url,
    shadow: node.data.props.shadow,
  }));
  const {
    actions: { setProp },
    title,
    url,
    isFormula,
    shadow,
  } = node;
  return (
    <div>
      <label>Card title</label>
      <OrFormula nodekey="title" {...{ setProp, isFormula, node }}>
        <input
          type="text"
          className="form-control"
          value={title}
          onChange={(e) => setProp((prop) => (prop.title = e.target.value))}
        />
      </OrFormula>
      <label>URL</label>
      <OrFormula nodekey="url" {...{ setProp, isFormula, node }}>
        <input
          type="text"
          className="form-control"
          value={url}
          onChange={(e) => setProp((prop) => (prop.url = e.target.value))}
        />
      </OrFormula>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={shadow}
          onChange={(e) => setProp((prop) => (prop.shadow = e.target.checked))}
        />
        <label className="form-check-label">Shadow</label>
      </div>
    </div>
  );
};
Card.craft = {
  props: {
    title: "",
    url: "",
    shadow: true,
    isFormula: {},
  },
  displayName: "Card",
  related: {
    settings: CardSettings,
  },
};
