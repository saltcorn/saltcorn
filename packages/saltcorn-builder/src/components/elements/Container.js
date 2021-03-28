import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  Accordion,
  BlockSetting,
  OrFormula,
  parseStyles,
  SelectUnits,
} from "./utils";

export const Container = ({
  children,
  borderWidth,
  borderStyle,
  minHeight,
  height,
  width,
  minHeightUnit,
  heightUnit,
  widthUnit,
  vAlign,
  hAlign,
  bgFileId,
  imageSize,
  bgType,
  block,
  bgColor,
  setTextColor,
  textColor,
  customClass,
  customCSS,
  margin,
  padding,
  minScreenWidth,
  borderRadius,
  borderRadiusUnit,
  borderColor,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div
      ref={(dom) => connect(drag(dom))}
      className={`${customClass || ""} text-${hAlign} ${
        vAlign === "middle" ? "d-flex align-items-center" : ""
      } ${
        vAlign === "middle" && hAlign === "center" && "justify-content-center"
      } ${selected ? "selected-node" : ""}`}
      style={{
        ...parseStyles(customCSS || ""),
        padding: padding.map((p) => p + "px").join(" "),
        margin: margin.map((p) => p + "px").join(" "),
        minHeight: `${Math.max(minHeight, 15)}${minHeightUnit || "px"}`,
        border: `${borderWidth}px ${borderStyle} ${borderColor || "black"}`,
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
              height: `${height}${heightUnit || "px"}`,
            }
          : {}),
        ...(typeof borderRadius !== "undefined"
          ? {
              borderRadius: `${borderRadius}${borderRadiusUnit || "px"}`,
            }
          : {}),
        ...(typeof width !== "undefined"
          ? {
              width: `${width}${widthUnit || "px"}`,
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
    borderRadius: node.data.props.borderRadius,
    borderRadiusUnit: node.data.props.borderRadiusUnit,
    borderColor: node.data.props.borderColor,
    minHeight: node.data.props.minHeight,
    height: node.data.props.height,
    width: node.data.props.width,
    minHeightUnit: node.data.props.minHeightUnit,
    heightUnit: node.data.props.heightUnit,
    widthUnit: node.data.props.widthUnit,
    bgType: node.data.props.bgType,
    bgColor: node.data.props.bgColor,
    isFormula: node.data.props.isFormula,
    bgFileId: node.data.props.bgFileId,
    imageSize: node.data.props.imageSize,
    vAlign: node.data.props.vAlign,
    hAlign: node.data.props.hAlign,
    block: node.data.props.block,
    showIfFormula: node.data.props.showIfFormula,
    setTextColor: node.data.props.setTextColor,
    showForRole: node.data.props.showForRole,
    textColor: node.data.props.textColor,
    customClass: node.data.props.customClass,
    customCSS: node.data.props.customCSS,
    minScreenWidth: node.data.props.minScreenWidth,
    show_for_owner: node.data.props.show_for_owner,
    margin: node.data.props.margin,
    padding: node.data.props.padding,
    url: node.data.props.url,
    hoverColor: node.data.props.hoverColor,
  }));
  const {
    actions: { setProp },
    borderWidth,
    borderStyle,
    borderRadius,
    borderRadiusUnit,
    borderColor,
    minHeight,
    height,
    width,
    minHeightUnit,
    heightUnit,
    widthUnit,
    vAlign,
    hAlign,
    bgFileId,
    imageSize,
    bgType,
    block,
    bgColor,
    setTextColor,
    textColor,
    showIfFormula,
    isFormula,
    showForRole,
    customClass,
    customCSS,
    minScreenWidth,
    show_for_owner,
    margin,
    padding,
    url,
    hoverColor,
  } = node;
  const options = useContext(optionsCtx);
  const ownership = !!options.ownership;
  return (
    <Accordion>
      <table className="w-100" accordiontitle="Placement">
        <tbody>
          <tr>
            <th colSpan="2">Border</th>
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
                className="form-control-sm w-50 d-inline mr-2"
                min="0"
                max="20"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.borderWidth = e.target.value;
                  })
                }
              />
              px
            </td>
          </tr>
          <tr>
            <td>
              <label>Style</label>
            </td>
            <td>
              <select
                value={borderStyle}
                className="form-control-sm w-50"
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
            <td>
              <label>Color</label>
            </td>
            <td>
              <input
                type="color"
                value={borderColor}
                className="form-control-sm"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.borderColor = e.target.value;
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <td>
              <label>Radius</label>
            </td>
            <td>
              <input
                type="number"
                value={borderRadius}
                step="1"
                min="0"
                max="999"
                className="w-50 form-control-sm d-inline"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.borderRadius = e.target.value;
                  })
                }
              />
              <SelectUnits
                value={borderRadiusUnit}
                className="w-50 form-control-sm d-inline"
                vert={true}
                onChange={(e) =>
                  setProp((prop) => {
                    prop.borderRadiusUnit = e.target.value;
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <th colSpan="2">Size</th>
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
                className="w-50 form-control-sm d-inline"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.minHeight = e.target.value;
                  })
                }
              />
              <SelectUnits
                value={minHeightUnit}
                className="w-50 form-control-sm d-inline"
                vert={true}
                onChange={(e) =>
                  setProp((prop) => {
                    prop.minHeightUnit = e.target.value;
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
                className="w-50 form-control-sm d-inline"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.height = e.target.value;
                  })
                }
              />
              <SelectUnits
                value={heightUnit}
                className="w-50 form-control-sm d-inline"
                vert={true}
                onChange={(e) =>
                  setProp((prop) => {
                    prop.heightUnit = e.target.value;
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
                className="w-50 form-control-sm d-inline"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.width = e.target.value;
                  })
                }
              />
              <SelectUnits
                value={widthUnit}
                className="w-50 form-control-sm d-inline"
                vert={false}
                onChange={(e) =>
                  setProp((prop) => {
                    prop.widthUnit = e.target.value;
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <BlockSetting block={block} setProp={setProp} />
            </td>
          </tr>
        </tbody>
      </table>
      <table className="w-100" accordiontitle="Spacing">
        <tbody>
          <tr>
            <th></th>
            <th>Margin</th>
            <th>Padding</th>
          </tr>
          {["Top", "Right", "Bottom", "Left"].map((direction, ix) => (
            <tr key={ix}>
              <td>{direction}</td>
              <td>
                <input
                  type="number"
                  value={margin[ix]}
                  step="1"
                  className="form-control-sm w-100"
                  onChange={(e) =>
                    setProp((prop) => {
                      prop.margin[ix] = e.target.value;
                    })
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  value={padding[ix]}
                  step="1"
                  className="form-control-sm w-100"
                  onChange={(e) =>
                    setProp((prop) => {
                      prop.padding[ix] = e.target.value;
                    })
                  }
                />
              </td>
              <td>px</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-100" accordiontitle="Contents">
        <tbody>
          <tr>
            <th colSpan="2">Align</th>
          </tr>
          <tr>
            <td>
              <label>Vert</label>
            </td>
            <td>
              <select
                value={vAlign}
                className="form-control-sm"
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
                className="form-control-sm"
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
            <th colSpan="2">Background</th>
          </tr>
          <tr>
            <td>
              <label>Type</label>
            </td>
            <td>
              <select
                className="form-control-sm"
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
                    className="form-control-sm"
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
                    className="form-control-sm"
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
              <td></td>
              <td>
                <OrFormula nodekey="bgColor" {...{ setProp, isFormula, node }}>
                  <input
                    type="color"
                    value={bgColor}
                    className="form-control-sm w-50"
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
            <td colSpan="2">
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
                  className="form-control-sm"
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
      <table className="w-100" accordiontitle="Show if...">
        <tbody>
          {["show", "edit"].includes(options.mode) && (
            <tr>
              <th colSpan="2">Formula - show if true</th>
            </tr>
          )}
          {["show", "edit"].includes(options.mode) && (
            <tr>
              <td>
                <input
                  type="text"
                  className="form-control text-to-display"
                  value={showIfFormula}
                  onChange={(e) =>
                    setProp((prop) => (prop.showIfFormula = e.target.value))
                  }
                />
                <div style={{ marginTop: "-5px" }}>
                  <small className="text-muted text-monospace">FORMULA</small>
                </div>
              </td>
            </tr>
          )}
          <tr>
            <th colSpan="2">Role</th>
          </tr>
          {options.roles.map(({ role, id }) => (
            <tr key={id}>
              <td colSpan="2">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    name="block"
                    type="checkbox"
                    checked={
                      typeof showForRole[id] === "undefined"
                        ? true
                        : showForRole[id]
                    }
                    onChange={(e) =>
                      setProp(
                        (prop) => (prop.showForRole[id] = e.target.checked)
                      )
                    }
                  />
                  <label className="form-check-label">{role}</label>
                </div>
              </td>
            </tr>
          ))}
          {ownership ? (
            <tr>
              <td colSpan="2">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    name="block"
                    type="checkbox"
                    checked={show_for_owner}
                    onChange={(e) =>
                      setProp(
                        (prop) => (prop.show_for_owner = e.target.checked)
                      )
                    }
                  />
                  <label className="form-check-label">Owner</label>
                </div>
              </td>
            </tr>
          ) : null}
          <tr>
            <td>
              <label>Min screen width</label>
            </td>
            <td>
              <select
                value={minScreenWidth}
                className="w-100 ml-2"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.minScreenWidth = e.target.value;
                  })
                }
              >
                <option value="">all</option>
                <option value="sm">small</option>
                <option value="md">medium</option>
                <option value="lg">large</option>
                <option value="xl">x-large</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <div accordiontitle="Container link">
        <label>URL</label>
        <OrFormula nodekey="url" {...{ setProp, isFormula, node }}>
          <input
            type="text"
            className="form-control"
            value={url}
            onChange={(e) => setProp((prop) => (prop.url = e.target.value))}
          />
        </OrFormula>

        <label>Hover color</label>

        <input
          type="color"
          value={hoverColor}
          className="form-control-sm"
          onChange={(e) =>
            setProp((prop) => {
              prop.hoverColor = e.target.value;
            })
          }
        />
      </div>

      <div accordiontitle="Custom class/CSS">
        <div>
          <label>Custom class</label>
        </div>
        <OrFormula nodekey="customClass" {...{ setProp, isFormula, node }}>
          <input
            type="text"
            className="form-control text-to-display"
            value={customClass}
            onChange={(e) =>
              setProp((prop) => (prop.customClass = e.target.value))
            }
          />
        </OrFormula>
        <div>
          <label>Custom CSS</label>
        </div>
        <textarea
          rows="4"
          type="text"
          className="text-to-display form-control"
          value={customCSS}
          onChange={(e) => setProp((prop) => (prop.customCSS = e.target.value))}
        ></textarea>
      </div>
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
    showIfFormula: "",
    showForRole: [],
    margin: [0, 0, 0, 0],
    padding: [0, 0, 0, 0],
    minScreenWidth: "",
    show_for_owner: false,
  },
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: ContainerSettings,
  },
};
