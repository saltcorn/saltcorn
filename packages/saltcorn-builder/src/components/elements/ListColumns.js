/**
 * @category saltcorn-builder
 * @module components/elements/ListColumns
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
const ListColumns = ({ children, align }) => {
  const {
    selected,
    id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div className={selected ? "selected-node" : ""}>
      <div className={` ${id === "ROOT" ? "root-canvas" : ""}`}>{children}</div>
    </div>
  );
};

export /**
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const ListColumnsSettings = () => {
  useNode((node) => ({}));
  return <div></div>;
};

/**
 * @type {object}
 */
ListColumns.craft = {
  displayName: "ListColumns",
  props: {},
  rules: {
    canDrag: () => false,
    canDrop: () => false,
    canMoveIn: (incoming) => {
      return incoming?.data?.displayName === "ListColumn";
    },
  },
  related: {
    settings: ListColumnsSettings,
  },
};
