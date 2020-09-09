import React, { Fragment } from "react";
import { Text } from "./Text";

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
  const {
    actions: { setProp },
    title,
  } = useNode((node) => ({
    title: node.data.props.title,
  }));
  return (
    <div>
      <label>Card title</label>
      <input
        type="text"
        className="w-100"
        value={title}
        onChange={(e) => setProp((prop) => (prop.title = e.target.value))}
      />
    </div>
  );
};
Card.craft = {
  props: {
    title: "",
  },
  displayName: "Card",
  related: {
    settings: CardSettings,
  },
};
