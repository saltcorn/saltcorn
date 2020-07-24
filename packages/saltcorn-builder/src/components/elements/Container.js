import React, { Fragment } from "react";
import { Text } from "./Text";

import { Canvas, useNode } from "@craftjs/core";

export const Container = ({
  contents,
  borderWidth,
  borderStyle,
  minHeight,
  vAlign
}) => {
  const {
    connectors: { connect, drag }
  } = useNode();

  return (
    <div ref={dom => connect(drag(dom))} style={{ padding: "4px" }}>
      <Canvas
        id={`containerContents`}
        is="div"
        style={{
          border: `${borderWidth}px ${borderStyle} black`,
          minHeight: `${minHeight}px`
        }}
        className={`canvas ${
          vAlign === "middle" ? "d-flex align-items-center" : ""
        }`}
      >
        {contents}
      </Canvas>
    </div>
  );
};

export const ContainerSettings = () => {
  const { setProp, borderWidth, borderStyle, minHeight, vAlign } = useNode(
    node => ({
      borderWidth: node.data.props.borderWidth,
      borderStyle: node.data.props.borderStyle,
      minHeight: node.data.props.minHeight,
      vAlign: node.data.props.vAlign
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
      <br />
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
      <h6>Height</h6>
      <label>Min</label>
      <input
        type="number"
        value={minHeight}
        step="1"
        min="0"
        max="999"
        onChange={e =>
          setProp(prop => {
            prop.minHeight = e.target.value;
          })
        }
      />
      <br />
      <label>Align</label>

      <select
        value={vAlign}
        onChange={e =>
          setProp(prop => {
            prop.vAlign = e.target.value;
          })
        }
      >
        <option>top</option>
        <option>middle</option>
      </select>
    </div>
  );
};
Container.craft = {
  defaultProps: {
    borderWidth: 0,
    borderStyle: "solid",
    minHeight: 0,
    vAlign: "top"
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
