/**
 * @category saltcorn-builder
 * @module components/elements/Card
 * @subcategory components / elements
 */

import React, { Fragment } from "react";
import { Text } from "./Text";
import { OrFormula, SettingsRow, Accordion, reactifyStyles } from "./utils";

import { Element, useNode } from "@craftjs/core";
import { BoxModelEditor } from "./BoxModelEditor";
import { bstyleopt } from "./utils";

export /**
 * @param {object} props
 * @param {string} props.children
 * @param {object} props.isFormula
 * @param {string} [props.title]
 * @param {string} props.shadow
 * @param {boolean} props.noPadding
 * @param {object} props.style
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const Card = ({ children, isFormula, title, shadow, noPadding, style }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));

  return (
    <div
      className={`card ${shadow ? "shadow" : ""} builder ${
        selected ? "selected-node" : ""
      }`}
      style={reactifyStyles(style)}
      ref={(dom) => connect(drag(dom))}
    >
      {title && title.length > 0 && (
        <div className="card-header">
          {isFormula?.title ? (
            <span className="font-monospace">={title}</span>
          ) : (
            title
          )}
        </div>
      )}
      <div className={`card-body ${noPadding ? "p-0" : ""}`}>
        <div className="canvas">{children}</div>
      </div>
    </div>
  );
};

export /**
 * @returns {Accordion}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const CardSettings = () => {
  const node = useNode((node) => {
    const ps = {};
    fields.forEach((f) => {
      ps[f.name] = node.data.props[f.name];
    });
    if (fields.some((f) => f.canBeFormula))
      ps.isFormula = node.data.props.isFormula;
    return ps;
  });
  const {
    actions: { setProp },
  } = node;

  return (
    <Accordion>
      <table className="w-100" accordiontitle="Card properties">
        <tbody>
          <SettingsRow
            field={{
              label: "Card title",
              name: "title",
              type: "String",
              canBeFormula: true,
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              label: "URL",
              name: "url",
              type: "String",
              canBeFormula: true,
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ label: "Shadow", name: "shadow", type: "Bool" }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              label: "Save indicator",
              name: "titleAjaxIndicator",
              type: "Bool",
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ label: "No padding", name: "noPadding", type: "Bool" }}
            node={node}
            setProp={setProp}
          />
        </tbody>
      </table>
      <div accordiontitle="Box" className="w-100">
        <BoxModelEditor setProp={setProp} node={node} sizeWithStyle={true} />
      </div>
    </Accordion>
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
  { label: "Save indicator", name: "titleAjaxIndicator", type: "Bool" },
  { label: "No padding", name: "noPadding", type: "Bool" },
  { name: "style", default: {} },
];

/**
 * @type {object}
 */
Card.craft = {
  props: {
    title: "",
    url: "",
    shadow: true,
    isFormula: {},
    style: {},
  },
  displayName: "Card",
  related: {
    settings: CardSettings,
    segment_type: "card",
    hasContents: true,
    fields,
  },
};
