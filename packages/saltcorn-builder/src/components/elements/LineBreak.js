/**
 * @category saltcorn-builder
 * @module components/elements/LineBreak
 * @subcategory components / elements
 */

import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";
import { SettingsFromFields } from "./utils";

export /**
 * @param {object} [props = {}]
 * @returns {Fragment}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const LineBreak = ({ hr }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return hr ? (
    <hr></hr>
  ) : (
    <Fragment>
      <span
        className={selected ? "selected-node" : ""}
        ref={(dom) => connect(drag(dom))}
      >
        ↵
      </span>
      <br />
    </Fragment>
  );
};

/**
 * @type {object}
 */
LineBreak.craft = {
  displayName: "LineBreak",
  related: {
    settings: SettingsFromFields([
      { label: "Page break", name: "page_break_after", type: "Bool" },
      { label: "Horizontal rule", name: "hr", type: "Bool" },
    ]),
    segment_type: "line_break",
    fields: [],
  },
};
