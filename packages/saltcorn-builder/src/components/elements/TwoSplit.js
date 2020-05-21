import React from "react";
import { Text } from "./Text";

import { Canvas, useNode } from "@craftjs/core";

export const TwoSplit = ({ leftCols }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <div className="row" ref={dom => connect(drag(dom))}>
      <div className={`split-col col-sm-${leftCols}`}>
        <Canvas id="Left" is="div">
          <Text text="Left" />
        </Canvas>
      </div>
      <div className={`split-col col-sm-${12 - leftCols}`}>
        <Canvas id="Right" is="div">
          <Text text="Right" />
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
