import React from "react";
import { Text } from "./Text";

import { Canvas, useNode } from "@craftjs/core";

export const TwoSplit = ({ leftCols, left, right }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <div className="row" ref={dom => connect(drag(dom))}>
      <div className={`split-col col-sm-${leftCols}`}>
        <Canvas id="Left" is="div" className="canvas">
          {left}
        </Canvas>
      </div>
      <div className={`split-col col-sm-${12 - leftCols}`}>
        <Canvas id="Right" is="div" className="canvas">
          {right}
        </Canvas>
      </div>
    </div>
  );
};
export const TwoSplitSettings = () => {
  const { setProp, leftCols } = useNode(node => ({
    leftCols: node.data.props.leftCols
  }));
  return (
    <div>
      <h6>Split settings</h6>
      <label>Left columns (out of 12)</label>
      <input
        type="number"
        value={leftCols}
        step="1"
        min="1"
        max="11"
        onChange={e => setProp(prop => (prop.leftCols = e.target.value))}
      />
    </div>
  );
};
TwoSplit.craft = {
  defaultProps: {
    leftCols: 6
  },
  related: {
    settings: TwoSplitSettings
  }
};
