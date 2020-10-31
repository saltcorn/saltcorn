import React, { Fragment } from "react";
import { Text } from "./Text";
import { OrFormula } from "./utils";

import { Element, useNode } from "@craftjs/core";

export const Card = ({ children, title }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));

  return (
    <div
      className={`card builder ${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      {title && title.length > 0 && <div className="card-header">{title}</div>}
      <div className="card-body canvas">{children}</div>
    </div>
  );
};

export const CardSettings = () => {
  const node = useNode((node) => ({
    title: node.data.props.title,
    isFormula: node.data.props.isFormula,
    url: node.data.props.url,
  }));
  const {
    actions: { setProp },
    title,
    url,
    isFormula,
  } = node;
  return (
    <div>
      <label>Card title</label>
      <input
        type="text"
        className="w-100"
        value={title}
        onChange={(e) => setProp((prop) => (prop.title = e.target.value))}
      />
      <label>URL</label>
      <OrFormula nodekey="url" {...{ setProp, isFormula, node }}>
        <input
          type="text"
          className="form-control "
          value={url}
          onChange={(e) => setProp((prop) => (prop.url = e.target.value))}
        />
      </OrFormula>
    </div>
  );
};
Card.craft = {
  props: {
    title: "",
    url: "",
    isFormula: {},
  },
  displayName: "Card",
  related: {
    settings: CardSettings,
  },
};
