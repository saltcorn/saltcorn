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
        <Canvas id="Left" is="div">
          {left}
        </Canvas>
      </div>
      <div className={`split-col col-sm-${12 - leftCols}`}>
        <Canvas id="Right" is="div">
          {right}
        </Canvas>
      </div>
    </div>
  );
};

TwoSplit.craft = {
  defaultProps: {
    leftCols: 6
  }
};
