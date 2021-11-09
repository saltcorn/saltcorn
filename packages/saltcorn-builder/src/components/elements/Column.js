/**
 * @category saltcorn-builder
 * @module components/elements/Column
 * @subcategory components / elements
 */

import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import optionsCtx from "../context";

export /**
 * 
 * @param {object} props 
 * @param {string} props.children
 * @param {*} props.align
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const Column = ({ children, align }) => {
  const {
    selected,
    id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div
      className={selected ? "selected-node" : ""}
      ref={(dom) => connect(drag(dom))}
    >
      <div className={`canvas ${id === "ROOT" ? "root-canvas" : ""}`}>
        {children}
      </div>
    </div>
  );
};

export /**
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const ColumnSettings = () => {
  const {} = useNode((node) => ({}));
  return <div></div>;
};

/** 
 * @type {object} 
 */
Column.craft = {
  displayName: "Column",
  props: {},
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: ColumnSettings,
  },
};
