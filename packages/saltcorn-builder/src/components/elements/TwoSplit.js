import React, { Fragment } from "react";
import { Text } from "./Text";

import { Canvas, useNode } from "@craftjs/core";

export const ntimes = (n, f) => {
  var res = [];
  for (let index = 0; index < n; index++) {
    res.push(f(index));
  }
  return res;
};

export const sum = xs => {
  var res = 0;
  for (const x of xs) res += x;
  return res;
};

const resetWidths = ncols => ntimes(ncols - 1, () => 12 / ncols);

const getWidth = (widths, colix) =>
  colix < widths.length ? widths[colix] : 12 - sum(widths);

export const TwoSplit = ({ widths, contents, ncols, aligns }) => {
  const {
    connectors: { connect, drag }
  } = useNode();

  return (
    <div className="row" ref={dom => connect(drag(dom))}>
      {ntimes(ncols, ix => (
        <div key={ix} className={`split-col col-sm-${getWidth(widths, ix)}`}>
          <Canvas
            id={`Col${ix}`}
            is="div"
            className={`canvas text-${aligns[ix]}`}
          >
            {contents[ix]}
          </Canvas>
        </div>
      ))}
    </div>
  );
};

export const TwoSplitSettings = () => {
  const { setProp, widths, ncols, aligns } = useNode(node => ({
    widths: node.data.props.widths,
    aligns: node.data.props.aligns,
    ncols: node.data.props.ncols
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
          onChange={e =>
            setProp(prop => {
              prop.ncols = e.target.value;
              prop.widths = resetWidths(e.target.value);
            })
          }
        />
      </div>
      {ntimes(ncols, ix => (
        <div key={ix}>
          <h6>Column {ix + 1}</h6>
          {ix < ncols - 1 && (
            <div>
              <label>width</label>
              <input
                type="number"
                value={widths[ix]}
                step="1"
                min="1"
                max={12 - ncols}
                onChange={e =>
                  setProp(prop => (prop.widths[ix] = +e.target.value))
                }
              />
              /12
            </div>
          )}
          <label>Align</label>
          <select
            value={aligns[ix]}
            onChange={e => setProp(prop => (prop.aligns[ix] = e.target.value))}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="justify">Justify</option>
            <option value="right">Right</option>
          </select>
        </div>
      ))}
    </div>
  );
};
TwoSplit.craft = {
  defaultProps: {
    widths: [6],
    aligns: ["left", "left"],
    ncols: 2
  },
  related: {
    settings: TwoSplitSettings
  }
};
