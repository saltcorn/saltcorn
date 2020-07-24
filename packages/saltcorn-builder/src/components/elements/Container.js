import React, { Fragment } from "react";
import { Text } from "./Text";

import { Canvas, useNode } from "@craftjs/core";

export const Container = ({ contents, borderWidth, borderStyle }) => {
  const {
    connectors: { connect, drag }
  } = useNode();

  return (
    <div ref={dom => connect(drag(dom))} style={{ padding: "4px" }}>
      <div style={{ border: `${borderWidth}px ${borderStyle} black` }}>
        <Canvas id={`containerContents`} is="div" className={`canvas`}>
          {contents}
        </Canvas>
      </div>
    </div>
  );
};

export const ContainerSettings = () => {
  const { setProp, borderWidth, borderStyle, minHeight, vCenter } = useNode(
    node => ({
      borderWidth: node.data.props.borderWidth,
      borderStyle: node.data.props.borderStyle,
      minHeight: node.data.props.minHeight,
      vCenter: node.data.props.vCenter
    })
  );
  return (
    <div>
      <h6>Border</h6>
      <label>Width</label>
      <input
        type="number"
        value={borderWidth}
        step="1"
        min="0"
        max="20"
        onChange={e =>
          setProp(prop => {
            prop.borderWidth = e.target.value;
          })
        }
      />
      <label>Style</label>
      <select
        value={borderStyle}
        onChange={e =>
          setProp(prop => {
            prop.borderStyle = e.target.value;
          })
        }
      >
        <option>solid</option>
        <option>dotted</option>
        <option>dashed</option>
        <option>double</option>
        <option>groove</option>
        <option>ridge</option>
        <option>inset</option>
        <option>outset</option>
      </select>
    </div>
  );
};
Container.craft = {
  defaultProps: {
    borderWidth: 0,
    borderStyle: "solid"
  },
  related: {
    settings: ContainerSettings
  }
};

/*
border colour and 
min-height
background
v-centre

*/
