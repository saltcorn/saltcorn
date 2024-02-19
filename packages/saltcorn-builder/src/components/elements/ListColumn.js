/**
 * @category saltcorn-builder
 * @module components/elements/Column
 * @subcategory components / elements
 */

import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import { setAPropGen, SettingsFromFields } from "./utils";
import { Column } from "./Column";

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
const ListColumn = ({
  alignment,
  colIndex,
  contents,
  header_label,
  showif,
  col_width,
  col_width_units,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div className="d-flex w-100">
      <div
        className={`${
          selected ? "selected-node" : ""
        } border list-column flex-50`}
        ref={(dom) => connect(drag(dom))}
      >
        Column {colIndex}:{header_label}
      </div>
      <Element canvas id={`listcol`} is={Column}>
        {contents}
      </Element>
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
    segment_type: "list_column",
    hasContents: true,
    colFields: fields,
  },
};
