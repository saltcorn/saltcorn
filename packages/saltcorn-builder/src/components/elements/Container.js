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
  reactifyStyles,
  bstyleopt,
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
  AlignBottom,
  SlashCircle,
  Image,
  Rainbow,
  Palette,
  EyeFill,
  EyeSlashFill,
} from "react-bootstrap-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faScroll, faRobot } from "@fortawesome/free-solid-svg-icons";
import { BoxModelEditor } from "./BoxModelEditor";

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const Container = ({
  children,
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
  display,
  bgColor,
  setTextColor,
  textColor,
  customClass,
  customCSS,
  margin,
  padding,
  minScreenWidth,
  gradStartColor,
  gradEndColor,
  gradDirection,
  rotate,
  style,
  htmlElement,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  //console.log("container style", style);
  return React.createElement(
    htmlElement,
    {
      ref: (dom) => connect(drag(dom)),
      className: `${customClass || ""} canvas text-${hAlign} ${
        vAlign === "middle" ? "d-flex align-items-center" : ""
      } ${
        vAlign === "middle" && hAlign === "center" && "justify-content-center"
      } ${selected ? "selected-node" : ""}`,
      style: {
        ...parseStyles(customCSS || ""),
        ...reactifyStyles(style),
        display,
        //padding: padding.map((p) => p + "px").join(" "),
        //margin: margin.map((p) => p + "px").join(" "),
        minHeight: minHeight ? `${minHeight}${minHeightUnit || "px"}` : null,
        ...(bgType === "Image" && bgFileId && +bgFileId
          ? {
              backgroundImage: `url('/files/serve/${bgFileId}')`,
              backgroundSize:
                imageSize === "repeat" ? undefined : imageSize || "contain",
              backgroundRepeat:
                imageSize === "repeat" ? imageSize : "no-repeat",
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
        ...(typeof width !== "undefined"
          ? {
              width: `${width}${widthUnit || "px"}`,
            }
          : {}),
        ...(rotate
          ? {
              transform: `rotate(${rotate}deg)`,
            }
          : {}),
      },
    },
    children
  );
};

export const ContainerSettings = () => {
  const node = useNode((node) => ({
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
    htmlElement: node.data.props.htmlElement,
    vAlign: node.data.props.vAlign,
    hAlign: node.data.props.hAlign,
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
    rotate: node.data.props.rotate,
    display: node.data.props.display,
    style: node.data.props.style,
  }));
  const {
    actions: { setProp },
    bgFileId,
    imageSize,
    bgType,
    display,
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
    htmlElement,
  } = node;
  const options = useContext(optionsCtx);
  const ownership = !!options.ownership;

  const setAProp = (key) => (e) => {
    if (e.target) {
      const target_value = e.target.value;
      setProp((prop) => (prop[key] = target_value));
    }
  };
  return (
    <Accordion>
      <div accordiontitle="Box" className="w-100">
        <BoxModelEditor setProp={setProp} node={node} />
      </div>
      <table className="w-100" accordiontitle="Display">
        <tbody>
          <SettingsRow
            field={{
              name: "display",
              label: "Display",
              type: "select",
              options: [
                "block",
                "inline",
                "inline-block",
                "none",
                "flex",
                "inline-flex",
              ],
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "htmlElement",
              label: "HTML element",
              type: "select",
              options: [
                "div",
                "span",
                "article",
                "section",
                "header",
                "nav",
                "main",
                "aside",
                "footer",
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
                { value: "visible", title: "Visible", label: <EyeFill /> },
                { value: "hidden", title: "Hidden", label: <EyeSlashFill /> },
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
      <table className="w-100" accordiontitle="Contents">
        <tbody>
          <SettingsRow
            field={{
              name: "rotate",
              label: "Rotate °",
              type: "Integer",
            }}
            node={node}
            setProp={setProp}
          />
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
                      onChange={setAProp("gradStartColor")}
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
                      onChange={setAProp("gradEndColor")}
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
                      onChange={setAProp("gradDirection")}
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
                    onChange={setAProp("bgFileId")}
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
                    onChange={setAProp("imageSize")}
                  >
                    <option>contain</option>
                    <option>cover</option>
                    <option>repeat</option>
                  </select>
                </td>
              </tr>
            </Fragment>
          )}
          {bgType === "Color" && (
            <tr>
              <td>Color</td>
              <td>
                <OrFormula nodekey="bgColor" {...{ setProp, isFormula, node }}>
                  <input
                    type="color"
                    value={bgColor}
                    className="form-control-sm w-50"
                    onChange={setAProp("bgColor")}
                  />
                </OrFormula>
              </td>
            </tr>
          )}
          <SettingsSectionHeaderRow title="Typography" />
          <SettingsRow
            field={{
              name: "font-family",
              label: "Font family",
              type: "String",
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <SettingsRow
            field={{
              name: "font-size",
              label: "Font size",
              type: "DimUnits",
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <SettingsRow
            field={{
              name: "font-weight",
              label: "Weight",
              type: "Integer",
              min: 100,
              max: 900,
              step: 100,
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <SettingsRow
            field={{
              name: "line-height",
              label: "Line height",
              type: "DimUnits",
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <tr>
            <td colSpan="2">
              <label>
                Set text color
                <input
                  name="setTextColor"
                  type="checkbox"
                  checked={setTextColor}
                  onChange={(e) =>
                    setProp((prop) => (prop.setTextColor = e.target.checked))
                  }
                />
              </label>
            </td>
          </tr>
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
                  onChange={setAProp("textColor")}
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <table className="w-100" accordiontitle="Flex properties">
        <tbody>
          <SettingsSectionHeaderRow title="Flex item" />
          <SettingsRow
            field={{ name: "flex-grow", label: "Grow", type: "Float" }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <SettingsRow
            field={{ name: "flex-shrink", label: "Shrink", type: "Float" }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          {display && display.includes("flex") && (
            <Fragment>
              <SettingsSectionHeaderRow title="Flex container" />
              <SettingsRow
                field={{
                  name: "flex-direction",
                  label: "Direction",
                  type: "select",
                  options: ["row", "row-reverse", "column", "column-reverse"],
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
              <SettingsRow
                field={{
                  name: "flex-wrap",
                  label: "Wrap",
                  type: "select",
                  options: ["nowrap", "wrap", "wrap-reverse"],
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
              <SettingsRow
                field={{
                  name: "justify-content",
                  label: "Justify content",
                  type: "select",
                  options: [
                    "flex-start",
                    "flex-end",
                    "center",
                    "space-between",
                    "space-around",
                    "space-evenly",
                    "start",
                    "end",
                    "left",
                    "right",
                  ],
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
              <SettingsRow
                field={{
                  name: "align-items",
                  label: "Align items",
                  type: "select",
                  options: [
                    "stretch",
                    "flex-start",
                    "flex-end",
                    "center",
                    "baseline",
                    "first baseline",
                    "last baseline",
                    "start",
                    "end",
                    "self-start",
                    "self-end",
                  ],
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
              <SettingsRow
                field={{
                  name: "align-content",
                  label: "Align content",
                  type: "select",
                  options: [
                    "flex-start",
                    "flex-end",
                    "center",
                    "space-between",
                    "space-around",
                    "space-evenly",
                    "stretch",
                    "start",
                    "end",
                    "baseline",
                    "first baseline",
                    "last baseline",
                  ],
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
            </Fragment>
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
                  onChange={setAProp("showIfFormula")}
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
                onChange={setAProp("minScreenWidth")}
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
                onChange={setAProp("maxScreenWidth")}
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
            onChange={setAProp("url")}
          />
        </OrFormula>

        <label>Hover color</label>
        <select
          value={hoverColor}
          className="form-control"
          onChange={setAProp("hoverColor")}
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
            onChange={setAProp("customClass")}
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
          onChange={setAProp("customCSS")}
        ></textarea>
      </div>
    </Accordion>
  );
};
Container.craft = {
  displayName: "Container",
  props: {
    minHeight: 0,
    vAlign: "top",
    hAlign: "left",
    bgFileId: 0,
    rotate: 0,
    isFormula: {},
    bgType: "None",
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
    display: "block",
    show_for_owner: false,
    style: {},
    htmlElement: "div",
  },
  rules: {
    canDrag: () => true,
  },
  related: {
    settings: ContainerSettings,
  },
};
