/**
 * @category saltcorn-builder
 * @module components/elements/Table
 * @subcategory components / elements
 */

import React, { Fragment, useState, useContext, useEffect } from "react";
import { ntimes } from "./Columns";
import { Column } from "./Column";
import optionsCtx from "../context";
import { setAPropGen, SettingsFromFields } from "./utils";

import { Element, useNode } from "@craftjs/core";

export /**
 * @param {object} props
 * @param {string[]} props.contents
 * @param {string[]} props.titles
 * @param {string} props.tabsStyle
 * @param {number} props.ntabs
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const Table = ({ contents, rows, columns }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <table
      className={`${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      <tbody>
        {ntimes(rows, (ri) => (
          <tr key={ri}>
            {ntimes(columns, (ci) => (
              <td key={ci}>
                <Element canvas id={`cell_${ri}_${ci}`} is={Column}>
                  {contents[ri][ci]}
                </Element>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const fields = [
  {
    label: "Rows",
    name: "rows",
    type: "Integer",
    attributes: { min: 0 },
  },
  {
    label: "Columns",
    name: "columns",
    type: "Integer",
    attributes: { min: 0 },
  },
];

/**
 * @type {object}
 */
Table.craft = {
  displayName: "Table",
  related: {
    settings: SettingsFromFields(fields),
    segment_type: "table",
    fields,
  },
};
