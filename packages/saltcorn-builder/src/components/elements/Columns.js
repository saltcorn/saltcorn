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
    connectors: { connect, drag },
  } = useNode();

  return (
    <div className="row" ref={(dom) => connect(drag(dom))}>
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
  } = useNode((node) => ({
    widths: node.data.props.widths,
    ncols: node.data.props.ncols,
  }));
  return (
    <div>
      <div>
        <label>Number of columns</label>
        <input
          type="number"
          value={ncols}
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
      </div>
      {ntimes(ncols, (ix) => (
        <div key={ix}>
          <h6>Column {ix + 1}</h6>

          <div>
            <label>width</label>
            {ix < ncols - 1 ? (
              <input
                type="number"
                value={widths[ix]}
                step="1"
                min="1"
                max={12 - ncols + 1}
                onChange={(e) =>
                  setProp((prop) => (prop.widths[ix] = +e.target.value))
                }
              />
            ) : (
              ` ${12 - sum(widths)}`
            )}
            /12
          </div>
        </div>
      ))}
    </div>
  );
};
Columns.craft = {
  defaultProps: {
    widths: [6],
    ncols: 2,
  },
  related: {
    settings: ColumnsSettings,
  },
};
