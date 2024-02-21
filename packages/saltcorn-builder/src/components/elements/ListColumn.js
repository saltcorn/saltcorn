/**
 * @category saltcorn-builder
 * @module components/elements/Column
 * @subcategory components / elements
 */

import React, {
  useContext,
  Fragment,
  useRef,
  useEffect,
  useState,
} from "react";

import { Element, useNode, useEditor } from "@craftjs/core";
import { setAPropGen, SettingsFromFields } from "./utils";
import { Column } from "./Column";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";
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
    id,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const { actions, query, isActve } = useEditor((state) => ({}));
  const options = useContext(optionsCtx);

  const {
    data: { parent },
  } = query.node(id).get();
  const siblings = query.node(parent).childNodes();
  const nChildren = siblings.length;
  const childIx = siblings.findIndex((sib) => sib === id);

  const moveDown = () => {
    const {
      data: { parent },
    } = query.node(id).get();
    actions.move(id, parent, childIx + 2);
  };
  const moveUp = () => {
    const {
      data: { parent },
    } = query.node(id).get();
    actions.move(id, parent, childIx - 1);
  };
  return (
    <div
      className={`${
        selected ? "selected-node" : ""
      } d-flex w-100 list-column-outer`}
      ref={(dom) => connect(drag(dom))}
    >
      <div className={`list-column flex-50 p-2`}>
        <div className="d-flex justify-content-between h-100">
          <div className="">
            Column{header_label ? `: ${header_label}` : ""}
            <br />
            {showif ? (
              <span className="badge bg-secondary me-2">showif</span>
            ) : (
              ""
            )}
            {alignment && alignment !== "Default" ? (
              <span className="badge bg-secondary me-2">Align {alignment}</span>
            ) : (
              ""
            )}
            {col_width ? (
              <span className="badge bg-secondary me-2">
                {col_width}
                {col_width_units}
              </span>
            ) : (
              ""
            )}
          </div>
          <div className="d-flex flex-column h-100 justify-content-between">
            {childIx !== null && childIx > 0 ? (
              <FontAwesomeIcon icon={faArrowUp} onClick={moveUp} />
            ) : (
              <span></span>
            )}
            {childIx !== null && childIx < nChildren - 1 ? (
              <FontAwesomeIcon icon={faArrowDown} onClick={moveDown} />
            ) : (
              <span></span>
            )}
          </div>
        </div>
      </div>
      <Element
        canvas
        id={`listcol`}
        is={Column}
        singleOccupancy={!options.allowMultipleElementsPerColumn}
      >
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
