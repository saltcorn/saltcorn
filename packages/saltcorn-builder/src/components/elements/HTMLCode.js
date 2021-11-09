/**
 * @category saltcorn-builder
 * @module components/elements/HTMLCode
 * @subcategory components / elements
 */

import React from "react";
import { useNode } from "@craftjs/core";
import {
  blockProps,
  BlockSetting,
  SettingsFromFields,
  TextStyleSetting,
} from "./utils";

export /**
 * @param {object} props
 * @param {string} props.text
 * @returns {span}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const HTMLCode = ({ text }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <span
      className={`is-html-block ${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      <div style={{ fontSize: "8px" }}>HTML</div>
      <div dangerouslySetInnerHTML={{ __html: text }}></div>
    </span>
  );
};

const fields = [
  {
    label: "HTML Code",
    name: "text",
    type: "textarea",
    segment_name: "contents"
  },
];

/**
 * @type {object}
 */
HTMLCode.craft = {
  displayName: "HTMLCode",
  related: {
    settings: SettingsFromFields(fields),
    segment_type: "blank",
    segment_vars: { isHTML: true },
    segment_match: (segment) => segment.isHTML,
    fields,
  },
};
