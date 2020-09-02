import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import optionsCtx from "../context";

export const Container = ({
  contents,
  borderWidth,
  borderStyle,
  minHeight,
  vAlign,
  hAlign,
  bgFileId,
  imageSize,
  bgType,
  bgColor,
  setTextColor,
  textColor,
}) => {
  const {
    connectors: { connect, drag },
  } = useNode();
  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`text-${hAlign} ${
        vAlign === "middle" ? "d-flex align-items-center" : ""
      } ${
        vAlign === "middle" && hAlign === "center" && "justify-content-center"
      }`}
      style={{
        padding: "4px",
        minHeight: `${Math.max(minHeight, 15)}px`,
        border: `${borderWidth}px ${borderStyle} black`,
        ...(bgType === "Image" && bgFileId && +bgFileId
          ? {
              backgroundImage: `url('/files/serve/${bgFileId}')`,
              backgroundSize: imageSize || "contain",
              backgroundRepeat: "no-repeat",
            }
          : {}),
        ...(bgType === "Color"
          ? {
              backgroundColor: bgColor,
            }
          : {}),
        ...(setTextColor
          ? {
              color: textColor,
            }
          : {}),
      }}
    >
      <Element
        canvas
        id={`containerContents`}
        is="div"
        style={{}}
        className={`canvas`}
      >
        {contents}
      </Element>
    </div>
  );
};

export const ContainerSettings = () => {
  const {
    actions: { setProp },
    borderWidth,
    borderStyle,
    minHeight,
    vAlign,
    hAlign,
    bgFileId,
    imageSize,
    bgType,
    bgColor,
    setTextColor,
    textColor,
  } = useNode((node) => ({
    borderWidth: node.data.props.borderWidth,
    borderStyle: node.data.props.borderStyle,
    minHeight: node.data.props.minHeight,
    bgType: node.data.props.bgType,
    bgColor: node.data.props.bgColor,
    bgFileId: node.data.props.bgFileId,
    imageSize: node.data.props.imageSize,
    vAlign: node.data.props.vAlign,
    hAlign: node.data.props.hAlign,
    setTextColor: node.data.props.setTextColor,
    textColor: node.data.props.textColor,
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
        onChange={(e) =>
          setProp((prop) => {
            prop.borderWidth = e.target.value;
          })
        }
      />
      <br />
      <label>Style</label>
      <select
        value={borderStyle}
        onChange={(e) =>
          setProp((prop) => {
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
        onChange={(e) =>
          setProp((prop) => {
            prop.minHeight = e.target.value;
          })
        }
      />
      <h6>Align</h6>
      <label>Vert</label>
      <select
        value={vAlign}
        onChange={(e) =>
          setProp((prop) => {
            prop.vAlign = e.target.value;
          })
        }
      >
        <option>top</option>
        <option>middle</option>
      </select>
      <br />
      <label>Horiz</label>
      <select
        value={hAlign}
        onChange={(e) =>
          setProp((prop) => {
            prop.hAlign = e.target.value;
          })
        }
      >
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="justify">Justify</option>
        <option value="right">Right</option>
      </select>
      <br />
      <label>Background</label>
      <select
        value={bgType}
        onChange={(e) => {
          setProp((prop) => {
            prop.bgType = e.target.value;
          });
          setProp((prop) => {
            prop.bgFileId =
              prop.bgFileId ||
              (options.images.length > 0 && options.images[0].id);
          });
        }}
      >
        <option>None</option>
        <option>Image</option>
        <option>Color</option>
      </select>
      {bgType === "Image" && (
        <Fragment>
          <br />
          <select
            value={bgFileId}
            onChange={(e) =>
              setProp((prop) => (prop.bgFileId = e.target.value))
            }
          >
            {options.images.map((f, ix) => (
              <option key={ix} value={f.id}>
                {f.filename}
              </option>
            ))}
          </select>
          <label>Size</label>
          <select
            value={imageSize}
            onChange={(e) =>
              setProp((prop) => {
                prop.imageSize = e.target.value;
              })
            }
          >
            <option>contain</option>
            <option>cover</option>
          </select>
        </Fragment>
      )}
      {bgType === "Color" && (
        <Fragment>
          <br />
          <input
            type="color"
            value={bgColor}
            onChange={(e) =>
              setProp((prop) => {
                prop.bgColor = e.target.value;
              })
            }
          />
        </Fragment>
      )}{" "}
      <br />
      <label>
        Set text color
        <input
          name="setTextColor"
          type="checkbox"
          checked={setTextColor}
          onChange={(e) =>
            setProp((prop) => (prop.setTextColor = e.target.checked))
          }
        />{" "}
      </label>
      {setTextColor && (
        <Fragment>
          <br />
          <input
            type="color"
            value={textColor}
            onChange={(e) =>
              setProp((prop) => {
                prop.textColor = e.target.value;
              })
            }
          />
        </Fragment>
      )}
    </div>
  );
};
Container.craft = {
  defaultProps: {
    borderWidth: 0,
    borderStyle: "solid",
    minHeight: 0,
    vAlign: "top",
    hAlign: "left",
    bgFileId: 0,
    bgType: "None",
    bgColor: "#ffffff",
    setTextColor: false,
    textColor: "#ffffff",
    imageSize: "contain",
  },
  related: {
    settings: ContainerSettings,
  },
};
