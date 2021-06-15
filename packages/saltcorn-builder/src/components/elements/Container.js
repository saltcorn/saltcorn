import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  Accordion,
  BlockSetting,
  OrFormula,
  parseStyles,
  SelectUnits,
  SettingsSectionHeaderRow,
  SettingsRow,
} from "./utils";
import {
  BorderOuter,
  BorderTop,
  BorderBottom,
  BorderLeft,
  BorderRight,
  BorderAll,
  AlignTop,
  AlignMiddle,
  AlignStart,
  AlignEnd,
  AlignCenter,
  Justify,
  Eye,
  EyeSlash,
  AlignBottom,
  SlashCircle,
  Image,
  Rainbow,
  Palette,
} from "react-bootstrap-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faScroll, faRobot } from "@fortawesome/free-solid-svg-icons";
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
  borderDirection,
  borderColor,
  gradStartColor,
  gradEndColor,
  gradDirection,
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
        [`border${
          borderDirection ? `-${borderDirection}` : ""
        }`]: `${borderWidth}px ${borderStyle} ${borderColor || "black"}`,
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
        ...(bgType === "Gradient"
          ? {
              backgroundImage: `linear-gradient(${
                gradDirection || 0
              }deg, ${gradStartColor}, ${gradEndColor})`,
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
    borderDirection: node.data.props.borderDirection,
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
    fullPageWidth: node.data.props.fullPageWidth,
    showIfFormula: node.data.props.showIfFormula,
    setTextColor: node.data.props.setTextColor,
    showForRole: node.data.props.showForRole,
    textColor: node.data.props.textColor,
    customClass: node.data.props.customClass,
    customCSS: node.data.props.customCSS,
    minScreenWidth: node.data.props.minScreenWidth,
    maxScreenWidth: node.data.props.maxScreenWidth,
    show_for_owner: node.data.props.show_for_owner,
    margin: node.data.props.margin,
    padding: node.data.props.padding,
    url: node.data.props.url,
    hoverColor: node.data.props.hoverColor,
    gradStartColor: node.data.props.gradStartColor,
    gradEndColor: node.data.props.gradEndColor,
    gradDirection: node.data.props.gradDirection,
    overflow: node.data.props.overflow,
  }));
  const {
    actions: { setProp },
    borderWidth,
    borderStyle,
    borderDirection,
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
    maxScreenWidth,
    show_for_owner,
    margin,
    padding,
    url,
    hoverColor,
    gradStartColor,
    gradEndColor,
    gradDirection,
    fullPageWidth,
    overflow,
  } = node;
  const options = useContext(optionsCtx);
  const ownership = !!options.ownership;
  const bstyleopt = (style) => ({
    value: style,
    title: style,
    label: (
      <div
        style={{
          borderLeftStyle: style,
          borderTopStyle: style,
          height: "15px",
          width: "6px",
        }}
      ></div>
    ),
  });
  return (
    <Accordion>
      <table className="w-100" accordiontitle="Placement">
        <tbody>
          <SettingsSectionHeaderRow title="Border" />
          <tr>
            <td>
              <label>Width</label>
            </td>
            <td>
              <div className="input-group input-group-sm w-100">
                <input
                  type="number"
                  value={borderWidth}
                  step="1"
                  className="form-control w-50"
                  min="0"
                  max="20"
                  onChange={(e) =>
                    setProp((prop) => {
                      prop.borderWidth = e.target.value;
                    })
                  }
                />
                <div class="input-group-append w-50 d-inline">
                  <span class="input-group-text">px</span>
                </div>
              </div>
            </td>
          </tr>
          <SettingsRow
            field={{
              name: "borderStyle",
              label: "Style",
              type: "btn_select",
              btnClass: "btnstylesel",
              options: [
                "solid",
                "dotted",
                "dashed",
                "double",
                "groove",
                "ridge",
                "inset",
                "outset",
              ].map(bstyleopt),
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "borderDirection",
              label: "Direction",
              type: "btn_select",
              btnClass: "btnstylesel",
              options: [
                { value: "", title: "None", label: <BorderAll /> },
                { value: "top", title: "Top", label: <BorderTop /> },
                { value: "bottom", title: "Bottom", label: <BorderBottom /> },
                { value: "left", title: "Left", label: <BorderLeft /> },
                { value: "right", title: "Right", label: <BorderRight /> },
              ],
            }}
            node={node}
            setProp={setProp}
          />

          <tr>
            <td>
              <label>Color</label>
            </td>
            <td>
              <input
                type="color"
                value={borderColor}
                className="form-control-sm w-50 mr-2"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.borderColor = e.target.value;
                  })
                }
              />
              <small>{borderColor}</small>
            </td>
          </tr>
          <SettingsRow
            field={{ name: "borderRadius", label: "Radius", type: "DimUnits" }}
            node={node}
            setProp={setProp}
          />
          <SettingsSectionHeaderRow title="Size" />
          <SettingsRow
            field={{ name: "minHeight", label: "Min height", type: "DimUnits" }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ name: "height", label: "Height", type: "DimUnits" }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ name: "width", label: "Widths", type: "DimUnits" }}
            node={node}
            setProp={setProp}
          />
          <tr>
            <td colSpan="2">
              <BlockSetting block={block} setProp={setProp} />
            </td>
          </tr>
          <tr>
            <td colSpan="2">
              <div className="form-check">
                <input
                  className="form-check-input"
                  name="block"
                  type="checkbox"
                  checked={fullPageWidth}
                  onChange={(e) =>
                    setProp((prop) => (prop.fullPageWidth = e.target.checked))
                  }
                />
                <label className="form-check-label">
                  Expand to full page width
                </label>
              </div>
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
          <SettingsSectionHeaderRow title="Align" />
          <SettingsRow
            field={{
              name: "vAlign",
              label: "Vertical",
              type: "btn_select",
              options: [
                { value: "top", title: "All", label: <AlignTop /> },
                { value: "middle", title: "All", label: <AlignMiddle /> },
                { value: "bottom", title: "All", label: <AlignBottom /> },
              ],
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "hAlign",
              label: "Horizontal",
              type: "btn_select",
              options: [
                { value: "left", title: "Left", label: <AlignStart /> },
                { value: "center", title: "Center", label: <AlignCenter /> },
                { value: "right", title: "Right", label: <AlignEnd /> },
                { value: "justify", title: "Justify", label: <Justify /> },
              ],
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "overflow",
              label: "Overflow",
              type: "btn_select",
              options: [
                { value: "visible", title: "Visible", label: <Eye /> },
                { value: "hidden", title: "Hidden", label: <EyeSlash /> },
                {
                  value: "scroll",
                  title: "Scroll",
                  label: <FontAwesomeIcon icon={faScroll} />,
                },
                {
                  value: "auto",
                  title: "Auto",
                  label: <FontAwesomeIcon icon={faRobot} />,
                },
              ],
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsSectionHeaderRow title="Background" />
          <SettingsRow
            field={{
              name: "bgType",
              label: "Type",
              type: "btn_select",
              options: [
                { value: "None", label: <SlashCircle /> },
                { value: "Image", label: <Image /> },
                { value: "Color", label: <Palette /> },
                { value: "Gradient", label: <Rainbow /> },
              ],
            }}
            node={node}
            setProp={setProp}
            onChange={(v) =>
              setProp((prop) => {
                prop.bgFileId =
                  prop.bgFileId ||
                  (options.images.length > 0 && options.images[0].id);
              })
            }
          />
          {bgType === "Gradient" && (
            <Fragment>
              <tr>
                <td>Start</td>
                <td>
                  <OrFormula
                    nodekey="gradStartColor"
                    {...{ setProp, isFormula, node }}
                  >
                    <input
                      type="color"
                      value={gradStartColor}
                      className="form-control-sm w-50"
                      onChange={(e) =>
                        setProp((prop) => {
                          prop.gradStartColor = e.target.value;
                        })
                      }
                    />
                  </OrFormula>
                </td>
              </tr>
              <tr>
                <td>End</td>
                <td>
                  <OrFormula
                    nodekey="gradEndColor"
                    {...{ setProp, isFormula, node }}
                  >
                    <input
                      type="color"
                      value={gradEndColor}
                      className="form-control-sm w-50"
                      onChange={(e) =>
                        setProp((prop) => {
                          prop.gradEndColor = e.target.value;
                        })
                      }
                    />
                  </OrFormula>
                </td>
              </tr>
              <tr>
                <td>Direction (&deg;)</td>
                <td>
                  <OrFormula
                    nodekey="gradDirection"
                    {...{ setProp, isFormula, node }}
                  >
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={gradDirection}
                      className="form-control-sm w-50"
                      onChange={(e) =>
                        setProp((prop) => {
                          prop.gradDirection = e.target.value;
                        })
                      }
                    />
                  </OrFormula>
                </td>
              </tr>
            </Fragment>
          )}
          {bgType === "Image" && (
            <Fragment>
              <tr>
                <td>
                  <label>File</label>
                </td>
                <td>
                  <select
                    value={bgFileId}
                    className="form-control-sm w-100"
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
            <SettingsSectionHeaderRow title="Formula - show if true" />
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
          <SettingsSectionHeaderRow title="Role" />
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
                className="form-control"
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
          <tr>
            <td>
              <label>Max screen width</label>
            </td>
            <td>
              <select
                value={maxScreenWidth}
                className="form-control"
                onChange={(e) =>
                  setProp((prop) => {
                    prop.maxScreenWidth = e.target.value;
                  })
                }
              >
                <option value="">all</option>
                <option value="md">small</option>
                <option value="lg">medium</option>
                <option value="xl">large</option>
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
        <select
          value={hoverColor}
          className="form-control"
          onChange={(e) =>
            setProp((prop) => {
              prop.hoverColor = e.target.value;
            })
          }
        >
          <option value="">None</option>
          <option value="gray">gray</option>
          <option value="gray-dark">gray-dark</option>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
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
    fullPageWidth: false,
    bgColor: "#ffffff",
    borderColor: "#000000",
    setTextColor: false,
    textColor: "#ffffff",
    gradStartColor: "#ff8888",
    gradEndColor: "#88ff88",
    gradDirection: "0",
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
