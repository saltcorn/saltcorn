/**
 * @category saltcorn-builder
 * @module components/elements/Columns
 * @subcategory components / elements
 */

import React, { Fragment } from "react";
import { Column } from "./Column";

import { Element, useNode } from "@craftjs/core";
import {
  Accordion,
  ConfigField,
  SettingsRow,
  reactifyStyles,
  SettingsSectionHeaderRow,
  buildBootstrapOptions,
} from "./utils";
import { BoxModelEditor } from "./BoxModelEditor";
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
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div
      className={`row ${selected ? "selected-node" : ""} ${
        typeof gx !== "undefined" && gx !== null ? `gx-${gx}` : ""
      } ${typeof gy !== "undefined" && gy !== null ? `gy-${gy}` : ""}`}
      ref={(dom) => connect(drag(dom))}
      style={reactifyStyles(style || {})}
    >
      {ntimes(ncols, (ix) => (
        <div
          key={ix}
          className={`split-col col-sm-${getWidth(widths, ix)} text-${
            aligns?.[ix]
          } align-items-${vAligns?.[ix]}`}
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
  } = node;
  const colSetsNode = {
    vAlign: vAligns?.[setting_col_n - 1],
    hAlign: aligns?.[setting_col_n - 1],
  };
  return (
    <Accordion>
      <table accordiontitle="Column properties">
        <tbody>
          <tr>
            <td colSpan="3">
              <label>Number of columns</label>
            </td>
            <td>
              <input
                type="number"
                value={ncols}
                className="form-control"
                step="1"
                min="1"
                max="6"
                onChange={(e) => {
                  if (!e.target) return;
                  const value = e.target.value;
                  setProp((prop) => {
                    prop.ncols = value;
                    prop.widths = resetWidths(value);
                  });
                }}
              />
            </td>
          </tr>
          <tr>
            <th colSpan="4">Widths &amp; Breakpoint</th>
          </tr>
          {ntimes(ncols, (ix) => (
            <Fragment key={ix}>
              <tr>
                <th colSpan="4">Column {ix + 1}</th>
              </tr>
              <tr>
                <td>
                  <label>Width</label>
                </td>
                <td align="right">
                  {ix < ncols - 1 ? (
                    <input
                      type="number"
                      value={widths[ix]}
                      className="form-control"
                      step="1"
                      min="1"
                      max={12 - (sum(widths) - widths[ix]) - 1}
                      onChange={(e) => {
                        if (!e.target) return;
                        const value = e.target.value;
                        setProp((prop) => (prop.widths[ix] = +value));
                      }}
                    />
                  ) : (
                    `${12 - sum(widths)}`
                  )}
                </td>
                <td>/12</td>
                <td>
                  <select
                    className="form-control form-select"
                    value={breakpoints[ix]}
                    onChange={(e) => {
                      if (!e.target) return;
                      const value = e.target.value;
                      setProp((prop) => (prop.breakpoints[ix] = value));
                    }}
                  >
                    <option disabled>Breakpoint</option>
                    <option value="">none</option>
                    {buildBootstrapOptions(["sm", "md", "lg"])}
                  </select>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <div accordiontitle="Column settings">
        Settings for column #
        <ConfigField
          field={{
            name: "setting_col_n",
            label: "Column number",
            type: "btn_select",
            options: ntimes(ncols, (i) => ({
              value: i + 1,
              title: `${i + 1}`,
              label: `${i + 1}`,
            })),
          }}
          node={node}
          setProp={setProp}
          props={node}
        ></ConfigField>
        <table>
          <tbody>
            <SettingsSectionHeaderRow title="Align" />
            <SettingsRow
              field={{
                name: "vAlign",
                label: "Vertical",
                type: "btn_select",
                options: [
                  { value: "start", title: "All", label: <AlignTop /> },
                  { value: "center", title: "All", label: <AlignMiddle /> },
                  { value: "end", title: "All", label: <AlignBottom /> },
                ],
              }}
              node={colSetsNode}
              setProp={setProp}
              onChange={(k, v) =>
                setProp((prop) => {
                  if (!prop.vAligns) prop.vAligns = [];
                  prop.vAligns[setting_col_n - 1] = v;
                })
              }
            />
            <SettingsRow
              field={{
                name: "hAlign",
                label: "Horizontal",
                type: "btn_select",
                options: [
                  { value: "start", title: "Left", label: <AlignStart /> },
                  { value: "center", title: "Center", label: <AlignCenter /> },
                  { value: "end", title: "Right", label: <AlignEnd /> },
                ],
              }}
              node={colSetsNode}
              setProp={setProp}
              onChange={(k, v) =>
                setProp((prop) => {
                  if (!prop.aligns) prop.aligns = [];
                  prop.aligns[setting_col_n - 1] = v;
                })
              }
            />
          </tbody>
        </table>
      </div>
      <table className="w-100" accordiontitle="Gutters">
        <tbody>
          <SettingsRow
            field={{
              name: "gx",
              label: "Horizontal 0-5",
              type: "Integer",
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "gy",
              label: "Vertical 0-5",
              type: "Integer",
            }}
            node={node}
            setProp={setProp}
          />
        </tbody>
      </table>
      <div accordiontitle="Box" className="w-100">
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
    setting_col_n: 1,
  },
  related: {
    settings: ColumnsSettings,
  },
};
