import React, { Fragment } from "react";
import { Column } from "./Column";

import { Element, useNode } from "@craftjs/core";

export const ntimes = (n, f) => {
  var res = [];
  for (let index = 0; index < n; index++) {
    res.push(f(index));
  }
  return res;
};

export const sum = (xs) => {
  var res = 0;
  for (const x of xs) res += x;
  return res;
};

const resetWidths = (ncols) => ntimes(ncols - 1, () => 12 / ncols);

const getWidth = (widths, colix) =>
  colix < widths.length ? widths[colix] : 12 - sum(widths);

export const Columns = ({ widths, contents, ncols }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div
      className={`row ${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      {ntimes(ncols, (ix) => (
        <div key={ix} className={`split-col col-sm-${getWidth(widths, ix)}`}>
          <Element canvas id={`Col${ix}`} is={Column}>
            {contents[ix]}
          </Element>
        </div>
      ))}
    </div>
  );
};

export const ColumnsSettings = () => {
  const {
    actions: { setProp },
    widths,
    ncols,
    breakpoints,
  } = useNode((node) => ({
    widths: node.data.props.widths,
    ncols: node.data.props.ncols,
    breakpoints: node.data.props.breakpoints,
  }));
  return (
    <div>
      <table>
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
                max="4"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.ncols = e.target.value;
                    prop.widths = resetWidths(e.target.value);
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <th colSpan="4">Widths &amp; Breakpoint</th>
          </tr>
          {ntimes(ncols, (ix) => (
            <Fragment key={ix}>
              <tr>
                {" "}
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
                      onChange={(e) =>
                        setProp((prop) => (prop.widths[ix] = +e.target.value))
                      }
                    />
                  ) : (
                    `${12 - sum(widths)}`
                  )}
                </td>
                <td>/12</td>
                <td>
                  <select
                    className="form-control"
                    value={breakpoints[ix]}
                    onChange={(e) =>
                      setProp((prop) => (prop.breakpoints[ix] = e.target.value))
                    }
                  >
                    <option disabled>Breakpoint</option>
                    <option value="">None</option>
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                  </select>
                </td>
              </tr>
            </Fragment>
          ))}{" "}
        </tbody>
      </table>
    </div>
  );
};
Columns.craft = {
  displayName: "Columns",
  defaultProps: {
    widths: [6],
    ncols: 2,
    breakpoints: ["sm", "sm"],
  },
  related: {
    settings: ColumnsSettings,
  },
};
