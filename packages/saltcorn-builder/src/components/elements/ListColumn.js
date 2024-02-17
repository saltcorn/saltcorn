/**
 * @category saltcorn-builder
 * @module components/elements/Column
 * @subcategory components / elements
 */

import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import { setAPropGen, SettingsFromFields } from "./utils";

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
const ListColumn = ({ alignment, header_label }) => {
  const {
    selected,
    id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div
      className={`${selected ? "selected-node" : ""} list-column`}
      ref={(dom) => connect(drag(dom))}
    >
      {header_label}
    </div>
  );
};

const fields = [
  {
    name: "header_label",
    label: "Header label",
    type: "String",
  },
  {
    name: "showif",
    label: "Show if true",
    sublabel: "Formula. Leave blank to always show",
    class: "validate-expression",
    type: "String",
    required: false,
  },
  {
    name: "col_width",
    label: "Column width",
    type: "Integer",
    attributes: { asideNext: true },
  },
  {
    name: "col_width_units",
    label: "Units",
    type: "String",
    required: true,
    attributes: {
      inline: true,
      options: ["px", "%", "vw", "em", "rem"],
    },
  },
  {
    name: "alignment",
    label: "Alignment",
    input_type: "select",
    options: ["Default", "Left", "Center", "Right"],
  },
];
ListColumn.craft = {
  displayName: "ListColumn",
  props: {},
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: SettingsFromFields(fields, {}),
    fields,
  },
};
