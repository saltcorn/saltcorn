import React from "react";
import { Canvas, useNode } from "@craftjs/core";

export const TwoSplit = ({ leftCols }) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <div className="row" ref={dom => connect(drag(dom))}>
      <div className={`col-sm-${leftCols}`}>
        <Canvas id="Left" is="div"></Canvas>
      </div>
      <div className={`col-sm-${12 - leftCols}`}>
        <Canvas id="Right" is="div"></Canvas>
      </div>
    </div>
  );
};

TwoSplit.craft = {
  defaultProps: {
    leftCols: 6
  }
};
