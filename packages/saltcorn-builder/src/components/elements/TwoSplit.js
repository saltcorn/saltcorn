import React from "react";
import { Text } from "./Text";

import { Canvas, useNode } from "@craftjs/core";

const ntimes = (n,f)=>{
  var res=[]
  for (let index = 0; index < n; index++) {
    res.push(f(index))    
  }
  return res
}

export const TwoSplit = ({ leftCols, contents, ncols }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <div className="row" ref={dom => connect(drag(dom))}>
      {ntimes(ncols, ix=>
      <div key={ix} className={`split-col col-sm-${12/ncols}`}>
        <Canvas id={`Col${ix}`} is="div" className="canvas">
          {contents[ix]}
        </Canvas>
      </div>
      )}

    </div>
  );
};
export const TwoSplitSettings = () => {
  const { setProp, leftCols, ncols } = useNode(node => ({
    leftCols: node.data.props.leftCols,
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
        onChange={e => setProp(prop => (prop.ncols = e.target.value))}
      />
    </div>
    <div>
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
    
    
    </div>
  );
};
TwoSplit.craft = {
  defaultProps: {
    leftCols: 6,
    ncols: 2
  },
  related: {
    settings: TwoSplitSettings
  }
};
