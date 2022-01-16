/**
 * @category saltcorn-builder
 * @module components/elements/Empty
 * @subcategory components / elements
 */

import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";

export /**
 * @param {object} [props = {}]
 * @returns {Fragment}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const Empty = ({}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return null;
};

/** 
 * @type {object} 
 */
Empty.craft = {
  displayName: "Empty",
};
