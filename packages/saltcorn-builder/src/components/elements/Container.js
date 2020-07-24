import React, { useContext, Fragment } from "react";

import { Canvas, useNode } from "@craftjs/core";
import optionsCtx from "../context";

export const Container = ({
  contents,
  borderWidth,
  borderStyle,
  minHeight,
  vAlign,
  bgFileId
}) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  console.log({ bgFileId });
  return (
    <div
      ref={dom => connect(drag(dom))}
      style={{
        padding: "4px",
        border: `${borderWidth}px ${borderStyle} black`
      }}
    >
      <Canvas
        id={`containerContents`}
        is="div"
        style={{
          minHeight: `${Math.max(minHeight, 15)}px`,
          ...(bgFileId && +bgFileId
            ? {
                backgroundImage: `url('/files/serve/${bgFileId}')`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat"
              }
            : {})
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
  const {
    setProp,
    borderWidth,
    borderStyle,
    minHeight,
    vAlign,
    bgFileId
  } = useNode(node => ({
    borderWidth: node.data.props.borderWidth,
    borderStyle: node.data.props.borderStyle,
    minHeight: node.data.props.minHeight,
    bgFileId: node.data.props.bgFileId,
    vAlign: node.data.props.vAlign
  }));
  const options = useContext(optionsCtx);
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
      <label>Background Image</label>
      <select
        value={bgFileId}
        onChange={e => setProp(prop => (prop.bgFileId = e.target.value))}
      >
        <option value={0}>None</option>
        {options.images.map((f, ix) => (
          <option key={ix} value={f.id}>
            {f.filename}
          </option>
        ))}
      </select>
    </div>
  );
};
Container.craft = {
  defaultProps: {
    borderWidth: 0,
    borderStyle: "solid",
    minHeight: 0,
    vAlign: "top",
    bgFileId: 0
  },
  related: {
    settings: ContainerSettings
  }
};
