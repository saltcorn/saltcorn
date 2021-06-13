import React, { Fragment } from "react";
import { Text } from "./Text";
import { OrFormula, SettingsFromFields } from "./utils";

import { Element, useNode } from "@craftjs/core";

export const Card = ({ children, isFormula, title, shadow, noPadding }) => {
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
      <div className={`card-body canvas ${noPadding ? "p-0" : ""}`}>
        {children}
      </div>
    </div>
  );
};


const fields = [
  {
    label: "Card title",
    name: "title",
    type: "String",
    canBeFormula: true,
  },
  { label: "URL", name: "url", type: "String", canBeFormula: true },
  { label: "Shadow", name: "shadow", type: "Bool" },
  { label: "No padding", name: "noPadding", type: "Bool" },
];

Card.craft = {
  props: {
    title: "",
    url: "",
    shadow: true,
    isFormula: {},
  },
  displayName: "Card",
  related: {
    settings: SettingsFromFields(fields),
    segment_type: "card",
    hasContents: true,
    fields,
  },
};
