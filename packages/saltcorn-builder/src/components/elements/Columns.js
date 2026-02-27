/**
 * @category saltcorn-builder
 * @module components/elements/Columns
 * @subcategory components / elements
 */

import React, { Fragment, useContext } from "react";
import { Column } from "./Column";
import useTranslation from "../../hooks/useTranslation";
import PreviewCtx from "../preview_context";

import { Element, useNode } from "@craftjs/core";
import {
  Accordion,
  SettingsRow,
  reactifyStyles,
  SettingsSectionHeaderRow,
  buildBootstrapOptions,
  parseStyles,
} from "./utils";
import { BoxModelEditor } from "./BoxModelEditor";
import { ArrayManager } from "./ArrayManager";
import {
  AlignTop,
  AlignMiddle,
  AlignStart,
  AlignEnd,
  AlignCenter,
  AlignBottom,
} from "react-bootstrap-icons";
export /**
 *
 * @param {number} n
 * @param {function} f
 * @returns {object[]}
 */
const ntimes = (n, f) => {
  var res = [];
  for (let index = 0; index < n; index++) {
    res.push(f(index));
  }
  return res;
};

export /**
 *
 * @param {number[]} xs
 * @returns {number}
 */
const sum = (xs) => {
  var res = 0;
  for (const x of xs) res += x;
  return res;
};

/**
 * @param {number} ncols
 * @returns {number}
 */
const resetWidths = (ncols) => ntimes(ncols - 1, () => Math.floor(12 / ncols));

/**
 * @param {number[]} widths
 * @param {number} colix
 * @returns {number}
 */
const getWidth = (widths, colix) =>
  colix < widths.length ? widths[colix] : 12 - sum(widths);

/**
 * Bootstrap breakpoint minimum widths (px)
 */
const BREAKPOINT_MIN_WIDTH = {
  "": 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
};

const PREVIEW_DEVICE_WIDTH = {
  desktop: Infinity,
  tablet: 768,
  mobile: 375,
};

const getColClass = (width, breakpoint, previewDevice) => {
  if (!previewDevice || previewDevice === "desktop") {
    const bp = breakpoint || "sm";
    return bp ? `col-${bp}-${width}` : `col-${width}`;
  }
  const deviceWidth = PREVIEW_DEVICE_WIDTH[previewDevice] || Infinity;
  const bpMin = BREAKPOINT_MIN_WIDTH[breakpoint || "sm"] || 0;
  if (deviceWidth < bpMin) return "col-12";
  const bp = breakpoint || "sm";
  return bp ? `col-${bp}-${width}` : `col-${width}`;
};

export /**
 * @param {object} opts
 * @param {number[]} opts.widths
 * @param {string[]} opts.contents
 * @param {number} opts.ncols
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const Columns = ({
  widths,
  contents,
  ncols,
  style,
  gx,
  gy,
  aligns,
  vAligns,
  colClasses,
  colStyles,
  customClass,
  breakpoints,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const { previewDevice } = useContext(PreviewCtx);
  return (
    <div
      className={`row builder-columns ${customClass || ""} ${selected ? "selected-node" : ""} ${
        typeof gx !== "undefined" && gx !== null ? `gx-${gx}` : ""
      } ${typeof gy !== "undefined" && gy !== null ? `gy-${gy}` : ""}`}
      ref={(dom) => connect(drag(dom))}
      style={reactifyStyles(style || {})}
    >
      {ntimes(ncols, (ix) => (
        <div
          key={ix}
          className={`split-col ${getColClass(
            getWidth(widths, ix),
            breakpoints?.[ix],
            previewDevice
          )} text-${
            aligns?.[ix]
          } align-items-${vAligns?.[ix]} ${colClasses?.[ix] || ""}`}
          style={parseStyles(colStyles?.[ix] || "")}
        >
          <Element canvas id={`Col${ix}`} is={Column}>
            {contents[ix]}
          </Element>
        </div>
      ))}
    </div>
  );
};

export /**
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const ColumnsSettings = () => {
  const { t } = useTranslation();
  const node = useNode((node) => ({
    widths: node.data.props.widths,
    ncols: node.data.props.ncols,
    breakpoints: node.data.props.breakpoints,
    style: node.data.props.style,
    setting_col_n: node.data.props.setting_col_n,
    gx: node.data.props.gx,
    gy: node.data.props.gy,
    vAligns: node.data.props.vAligns,
    aligns: node.data.props.aligns,
    colClasses: node.data.props.colClasses,
    colStyles: node.data.props.colStyles,
    customClass: node.data.props.customClass,
    currentSettingsTab: node.data.props.currentSettingsTab,
  }));
  const {
    actions: { setProp },
    widths,
    ncols,
    breakpoints,
    style,
    setting_col_n,
    vAligns,
    aligns,
    colClasses,
    colStyles,
    customClass,
    currentSettingsTab,
  } = node;
  const colSetsNode = {
    vAlign: vAligns?.[setting_col_n],
    hAlign: aligns?.[setting_col_n],
    colClass: colClasses?.[setting_col_n] || "",
    colStyle: colStyles?.[setting_col_n] || "",
  };
  return (
    <Accordion
      value={currentSettingsTab}
      onChange={(ix) => setProp((prop) => (prop.currentSettingsTab = ix))}
    >
      <div accordiontitle={t("Column properties")}>
        <ArrayManager
          node={node}
          setProp={setProp}
          countProp={"ncols"}
          currentProp={"setting_col_n"}
          managedArrays={["widths", "breakpoints", "aligns", "vAligns", "colClasses", "colStyles"]}
          manageContents={true}
          contentsKey={"besides"}
          initialAddProps={{
            breakpoints: "sm",
          }}
          onLayoutChange={(layout, action) => {
            if (action === "add" || action === "delete") {
              const n = layout.besides.length;
              layout.widths = ntimes(n, () => Math.floor(12 / n));
            }
          }}
        />
        <table className="w-100 mt-2">
          <tbody>
            <tr>
              <th colSpan="4">{t("Width & Breakpoint")}</th>
            </tr>
            <tr>
              <td>
                <label>{t("Width")}</label>
              </td>
              <td colSpan="3" align="right">
                {setting_col_n < ncols - 1 ? (
                  <input
                    type="number"
                    value={widths[setting_col_n]}
                    className="form-control"
                    step="1"
                    min="1"
                    max={12 - (sum(widths) - widths[setting_col_n]) - 1}
                    onChange={(e) => {
                      if (!e.target) return;
                      const value = e.target.value;
                      setProp((prop) => (prop.widths[setting_col_n] = +value));
                    }}
                  />
                ) : (
                  `${12 - sum(widths)}`
                )}
              </td>
            </tr>
            <tr>
              <td>
                <label>{t("Breakpoint")}</label>
              </td>
              <td colSpan="3">
                <select
                  className="form-control form-select"
                  value={breakpoints[setting_col_n]}
                  onChange={(e) => {
                    if (!e.target) return;
                    const value = e.target.value;
                    setProp((prop) => (prop.breakpoints[setting_col_n] = value));
                  }}
                >
                  <option value="">{t("none")}</option>
                  {buildBootstrapOptions(["sm", "md", "lg"])}
                </select>
              </td>
            </tr>
            <SettingsSectionHeaderRow title={t("Align")} />
            <SettingsRow
              field={{
                name: "vAlign",
                label: t("Vertical"),
                type: "btn_select",
                options: [
                  { value: "start", title: t("Start"), label: <AlignTop /> },
                  { value: "center", title: t("Center"), label: <AlignMiddle /> },
                  { value: "end", title: t("End"), label: <AlignBottom /> },
                ],
              }}
              node={colSetsNode}
              setProp={setProp}
              onChange={(k, v) =>
                setProp((prop) => {
                  if (!prop.vAligns) prop.vAligns = [];
                   prop.vAligns[setting_col_n] = v;
                })
              }
            />
            <SettingsRow
              field={{
                name: "hAlign",
                label: t("Horizontal"),
                type: "btn_select",
                options: [
                  { value: "start", title: t("Left"), label: <AlignStart /> },
                  { value: "center", title: t("Center"), label: <AlignCenter /> },
                  { value: "end", title: t("Right"), label: <AlignEnd /> },
                ],
              }}
              node={colSetsNode}
              setProp={setProp}
              onChange={(k, v) =>
                setProp((prop) => {
                  if (!prop.aligns) prop.aligns = [];
                   prop.aligns[setting_col_n] = v;
                })
              }
            />
            <SettingsRow
              field={{
                name: "colClass",
                label: t("Class"),
                type: "String",
              }}
              node={colSetsNode}
              setProp={setProp}
              onChange={(k, v) =>
                setProp((prop) => {
                  if (!prop.colClasses) prop.colClasses = [];
                   prop.colClasses[setting_col_n] = v;
                })
              }
            />
            <SettingsRow
              field={{
                name: "colStyle",
                label: t("CSS"),
                type: "String",
              }}
              node={colSetsNode}
              setProp={setProp}
              onChange={(k, v) =>
                setProp((prop) => {
                  if (!prop.colStyles) prop.colStyles = [];
                  prop.colStyles[setting_col_n] = v;
                })
              }
            />
          </tbody>
        </table>
      </div>
      <table className="w-100" accordiontitle={t("Gutters and class")}>
        <tbody>
          <SettingsRow
            field={{
              name: "gx",
              label: t("Horizontal 0-5"),
              type: "Integer",
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "gy",
              label: t("Vertical 0-5"),
              type: "Integer",
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "customClass",
              label: t("Custom class"),
              type: "String",
            }}
            node={node}
            setProp={setProp}
          />
        </tbody>
      </table>
      <div accordiontitle={t("Box")} className="w-100">
        <BoxModelEditor setProp={setProp} node={node} sizeWithStyle={true} />
      </div>
    </Accordion>
  );
};

/**
 * @type {object}
 */
Columns.craft = {
  displayName: "Columns",
  defaultProps: {
    widths: [6],
    ncols: 2,
    style: {},
    breakpoints: ["sm", "sm"],
    setting_col_n: 0,
    customClass: "",
  },
  related: {
    settings: ColumnsSettings,
  },
};
