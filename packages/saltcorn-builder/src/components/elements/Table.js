/**
 * @category saltcorn-builder
 * @module components/elements/Table
 * @subcategory components / elements
 */

import React, { Fragment, useState, useContext, useEffect } from "react";
import { ntimes } from "./Columns";
import { Column } from "./Column";
import useTranslation from "../../hooks/useTranslation";
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
const Table = ({
  contents,
  rows,
  columns,
  bs_style,
  bs_small,
  bs_striped,
  bs_bordered,
  bs_borderless,
  bs_wauto,
  customClass
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <table
      className={`${selected ? "selected-node" : ""} ${customClass} ${
        bs_style ? "table" : ""
      } ${bs_style && bs_small ? "table-sm" : ""} ${
        bs_style && bs_striped ? "table-striped" : ""
      } ${bs_style && bs_bordered ? "table-bordered" : ""} ${
        bs_style && bs_borderless ? "table-borderless" : ""
      } ${bs_style && bs_wauto ? "w-auto" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      <tbody>
        {ntimes(rows, (ri) => (
          <tr key={ri}>
            {ntimes(columns, (ci) => (
              <td key={ci}>
                <Element canvas id={`cell_${ri}_${ci}`} is={Column}>
                  {contents?.[ri]?.[ci]}
                </Element>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TableSettings = () => {
  const { t } = useTranslation();
  const fields = [
    {
      label: t("Rows"),
      name: "rows",
      type: "Integer",
      attributes: { min: 0 },
    },
    {
      label: t("Columns"),
      name: "columns",
      type: "Integer",
      attributes: { min: 0 },
    },
    {
      name: "customClass",
      label: t("Custom class"),
      type: "String",
    },
    {
      label: t("Bootstrap style"),
      name: "bs_style",
      type: "Bool",
    },
    {
      label: t("Small"),
      name: "bs_small",
      type: "Bool",
      showIf: { bs_style: true },
    },
    {
      label: t("Striped"),
      name: "bs_striped",
      type: "Bool",
      showIf: { bs_style: true },
    },
    {
      label: t("Bordered"),
      name: "bs_bordered",
      type: "Bool",
      showIf: { bs_style: true },
    },
    {
      label: t("Borderless"),
      name: "bs_borderless",
      type: "Bool",
      showIf: { bs_style: true },
    },
    {
      label: t("Auto width"),
      name: "bs_wauto",
      type: "Bool",
      showIf: { bs_style: true },
    },
  ];
  return (
    <SettingsFromFields
      fields={fields}
      onChange={(fnm, v, setProp) => {
        if (fnm === "rows")
          setProp((prop) => {
            ntimes(v, (i) => {
              if (!prop.contents[i]) prop.contents[i] = [];
            });
          });
      }}
    />
  );
};

/**
 * @type {object}
 */
Table.craft = {
  displayName: "Table",
  related: {
    settings: TableSettings,
  },
};
