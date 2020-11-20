import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import optionsCtx from "../context";
import { Accordion, BlockSetting, OrFormula } from "./utils";

export const Container = ({
  children,
  borderWidth,
  borderStyle,
  minHeight,
  height,
  width,
  vAlign,
  hAlign,
  bgFileId,
  imageSize,
  bgType,
  block,
  bgColor,
  setTextColor,
  textColor,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`text-${hAlign} ${
        vAlign === "middle" ? "d-flex align-items-center" : ""
      } ${
        vAlign === "middle" && hAlign === "center" && "justify-content-center"
      } ${selected ? "selected-node" : ""}`}
      style={{
        padding: "4px",
        minHeight: `${Math.max(minHeight, 15)}px`,
        border: `${borderWidth}px ${borderStyle} black`,
        ...(block === false ? { display: "inline-block" } : {}),
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
        ...(typeof height !== "undefined"
          ? {
              height: `${height}px`,
            }
          : {}),
        ...(typeof width !== "undefined"
          ? {
              width: `${width}px`,
            }
          : {}),
      }}
    >
      <div className="canvas">{children}</div>
    </div>
  );
};

export const ContainerSettings = () => {
  const node = useNode((node) => ({
    borderWidth: node.data.props.borderWidth,
    borderStyle: node.data.props.borderStyle,
    minHeight: node.data.props.minHeight,
    height: node.data.props.height,
    width: node.data.props.width,
    bgType: node.data.props.bgType,
    bgColor: node.data.props.bgColor,
    isFormula: node.data.props.isFormula,
    bgFileId: node.data.props.bgFileId,
    imageSize: node.data.props.imageSize,
    vAlign: node.data.props.vAlign,
    hAlign: node.data.props.hAlign,
    block: node.data.props.block,
    setTextColor: node.data.props.setTextColor,
    textColor: node.data.props.textColor,
  }));
  const {
    actions: { setProp },
    borderWidth,
    borderStyle,
    minHeight,
    height,
    width,
    vAlign,
    hAlign,
    bgFileId,
    imageSize,
    bgType,
    block,
    bgColor,
    setTextColor,
    textColor,
    isFormula,
  } = node;
  const options = useContext(optionsCtx);
  return (
    <Accordion>
      <table className="w-100" accordiontitle="Placement">
        <tbody>
          <tr>
            <th colspan="2">Border</th>
          </tr>
          <tr>
            <td>
              <label>Width</label>
            </td>
            <td>
              <input
                type="number"
                value={borderWidth}
                step="1"
                className="w-100 ml-2"
                min="0"
                max="20"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.borderWidth = e.target.value;
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <td>
              <label>Style</label>
            </td>
            <td>
              <select
                value={borderStyle}
                className="w-100 ml-2"
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
            </td>
          </tr>
          <tr>
            <th colspan="2">Size</th>
          </tr>
          <tr>
            <td>
              <label>Min height</label>
            </td>
            <td>
              <input
                type="number"
                value={minHeight}
                step="1"
                min="0"
                max="999"
                className="w-100 ml-2"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.minHeight = e.target.value;
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <td>
              <label>Height</label>
            </td>
            <td>
              <input
                type="number"
                value={height}
                step="1"
                min="0"
                max="999"
                className="w-100 ml-2"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.height = e.target.value;
                  })
                }
              />
            </td>
          </tr>{" "}
          <tr>
            <td>
              <label>Width</label>
            </td>
            <td>
              <input
                type="number"
                value={width}
                step="1"
                min="0"
                max="999"
                className="w-100 ml-2"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.width = e.target.value;
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <BlockSetting block={block} setProp={setProp} />
            </td>
          </tr>
        </tbody>
      </table>
      <table className="w-100" accordiontitle="Contents">
        <tbody>
          <tr>
            <th colspan="2">Align</th>
          </tr>
          <tr>
            <td>
              <label>Vert</label>
            </td>
            <td>
              <select
                value={vAlign}
                className="w-100 ml-2"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.vAlign = e.target.value;
                  })
                }
              >
                <option>top</option>
                <option>middle</option>
              </select>
            </td>
          </tr>
          <tr>
            <td>
              <label>Horiz</label>
            </td>
            <td>
              <select
                value={hAlign}
                className="w-100 ml-2"
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
            </td>
          </tr>
          <tr>
            <th colspan="2">Background</th>
          </tr>
          <tr>
            <td>
              <label>Type</label>
            </td>
            <td>
              <select
                className="w-100 ml-2"
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
            </td>
          </tr>
          {bgType === "Image" && (
            <Fragment>
              <tr>
                <td>
                  <label>File</label>
                </td>
                <td>
                  <select
                    value={bgFileId}
                    className="w-100 ml-2"
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
                </td>
              </tr>
              <tr>
                <td>
                  <label>Size</label>
                </td>

                <td>
                  <select
                    value={imageSize}
                    className="w-100 ml-2"
                    onChange={(e) =>
                      setProp((prop) => {
                        prop.imageSize = e.target.value;
                      })
                    }
                  >
                    <option>contain</option>
                    <option>cover</option>
                  </select>
                </td>
              </tr>
            </Fragment>
          )}
          {bgType === "Color" && (
            <tr>
              <td colspan="2">
                <OrFormula nodekey="bgColor" {...{ setProp, isFormula, node }}>
                  <input
                    type="color"
                    value={bgColor}
                    className="form-control"
                    onChange={(e) =>
                      setProp((prop) => {
                        prop.bgColor = e.target.value;
                      })
                    }
                  />
                </OrFormula>
              </td>
            </tr>
          )}
          <tr>
            <td colspan="2">
              <label>
                Set text color{" "}
                <input
                  name="setTextColor"
                  type="checkbox"
                  checked={setTextColor}
                  onChange={(e) =>
                    setProp((prop) => (prop.setTextColor = e.target.checked))
                  }
                />{" "}
              </label>
            </td>
          </tr>{" "}
          {setTextColor && (
            <tr>
              <td>
                <label>Text</label>
              </td>
              <td>
                <input
                  type="color"
                  value={textColor}
                  className="w-100 ml-2"
                  onChange={(e) =>
                    setProp((prop) => {
                      prop.textColor = e.target.value;
                    })
                  }
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Accordion>
  );
};
Container.craft = {
  displayName: "Container",
  props: {
    borderWidth: 0,
    borderStyle: "solid",
    minHeight: 0,
    vAlign: "top",
    hAlign: "left",
    bgFileId: 0,
    isFormula: {},
    bgType: "None",
    block: true,
    bgColor: "#ffffff",
    setTextColor: false,
    textColor: "#ffffff",
    imageSize: "contain",
  },
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: ContainerSettings,
  },
};
