/**
 * @category saltcorn-builder
 * @module components/elements/Container
 * @subcategory components / elements
 */

import React, { useContext, Fragment } from "react";

import { Element, useNode } from "@craftjs/core";
import optionsCtx from "../context";
import {
  Accordion,
  OrFormula,
  parseStyles,
  SettingsSectionHeaderRow,
  SettingsRow,
  reactifyStyles,
  setAPropGen,
  FormulaTooltip,
  buildOptions,
  buildBootstrapOptions,
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
  Images,
  Rainbow,
  Palette,
  EyeFill,
  EyeSlashFill,
} from "react-bootstrap-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faScroll, faRobot } from "@fortawesome/free-solid-svg-icons";
import { BoxModelEditor } from "./BoxModelEditor";
import previewCtx from "../preview_context";

export /**
 * @param {object} props
 * @param {*} props.children
 * @param {*} props.minHeight
 * @param {*} props.height
 * @param {*} props.width
 * @param {*} props.minHeightUnit
 * @param {*} props.heightUnit
 * @param {*} props.widthUnit
 * @param {*} props.vAlign
 * @param {*} props.hAlign
 * @param {*} props.bgFileId
 * @param {*} props.imageSize
 * @param {*} props.bgType
 * @param {*} props.display
 * @param {*} props.bgColor
 * @param {*} props.setTextColor
 * @param {*} props.textColor
 * @param {*} props.customClass
 * @param {*} props.customCSS
 * @param {*} props.margin
 * @param {*} props.padding
 * @param {*} props.minScreenWidth
 * @param {*} props.gradStartColor
 * @param {*} props.gradEndColor
 * @param {*} props.gradDirection
 * @param {*} props.rotate
 * @param {*} props.style
 * @param {*} props.htmlElement
 * @returns {DetailedReactHTMLElement}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const Container = ({
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
  customId,
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
  transform,
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
      id: customId || "",
      className: `${customClass || ""} kontainer canvas text-${hAlign} ${
        vAlign === "middle" ? "d-flex align-items-center" : ""
      } ${
        vAlign === "middle" && hAlign === "center" && "justify-content-center"
      } ${selected ? "selected-node" : ""}`,
      style: {
        ...parseStyles(customCSS || ""),
        ...reactifyStyles(style, transform, rotate),
        display,
        //padding: padding.map((p) => p + "px").join(" "),
        //margin: margin.map((p) => p + "px").join(" "),
        minHeight: minHeight ? `${minHeight}${minHeightUnit || "px"}` : null,
        ...(bgType === "Image" && bgFileId
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
      },
    },
    children
  );
};

export /**
 * @returns {div}
 * @returns {Accordion}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const ContainerSettings = () => {
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
    bgField: node.data.props.bgField,
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
    customId: node.data.props.customId,
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
    transform: node.data.props.transform,
    imgResponsiveWidths: node.data.props.imgResponsiveWidths,
    click_action: node.data.props.click_action,
    animateName: node.data.props.animateName,
    animateDelay: node.data.props.animateDelay,
    animateDuration: node.data.props.animateDuration,
    animateInitialHide: node.data.props.animateInitialHide,
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
    customId,
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
    imgResponsiveWidths,
    click_action,
    style,
    transform,
    bgField,
  } = node;
  const options = useContext(optionsCtx);
  const { uploadedFiles } = useContext(previewCtx);

  const ownership = !!options.ownership;

  /**
   * @param {string} key
   * @returns {function}
   */
  const setAProp = setAPropGen(setProp);
  //console.log("transform", transform);

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
          <SettingsRow
            field={{
              name: "opacity",
              label: "Opacity",
              type: "Float",
              attributes: { min: 0, max: 1 },
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          <SettingsRow
            field={{
              name: "position",
              label: "Position",
              type: "select",
              options: ["static", "relative", "fixed", "absolute", "sticky"],
            }}
            node={node}
            setProp={setProp}
            isStyle={true}
          />
          {style?.position && style?.position !== "static" ? (
            <Fragment>
              <SettingsRow
                field={{
                  name: "top",
                  label: "Top",
                  type: "DimUnits",
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
              <SettingsRow
                field={{
                  name: "right",
                  label: "Right",
                  type: "DimUnits",
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
              <SettingsRow
                field={{
                  name: "bottom",
                  label: "Bottom",
                  type: "DimUnits",
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
              <SettingsRow
                field={{
                  name: "left",
                  label: "Left",
                  type: "DimUnits",
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
            </Fragment>
          ) : null}
          <tr>
            <td colSpan="2">
              <div className="form-check">
                <input
                  className="form-check-input"
                  name="block"
                  type="checkbox"
                  checked={fullPageWidth}
                  onChange={setAProp("fullPageWidth", { checked: true })}
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
                { value: "start", title: "Left", label: <AlignStart /> },
                { value: "center", title: "Center", label: <AlignCenter /> },
                { value: "end", title: "Right", label: <AlignEnd /> },
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
                ...(options.mode === "show"
                  ? [{ value: "Image Field", label: <Images /> }]
                  : []),
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
                  ((options.images || []).length + uploadedFiles.length > 0 &&
                    options.images?.[0]?.location);
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
            <tr>
              <td>
                <label>File</label>
              </td>
              <td>
                <select
                  value={bgFileId}
                  className="form-control-sm w-100 form-select"
                  onChange={setAProp("bgFileId")}
                >
                  {options.images.map((f, ix) => (
                    <option key={ix} value={f.id}>
                      {f.filename}
                    </option>
                  ))}
                  {(uploadedFiles || []).map((uf, ix) => (
                    <option key={ix} value={uf.id}>
                      {uf.filename}
                    </option>
                  ))}{" "}
                </select>
              </td>
            </tr>
          )}
          {bgType === "Image Field" && (
            <tr>
              <td>
                <label>File field</label>
              </td>
              <td>
                <select
                  value={bgField}
                  className="form-control-sm w-100 form-select"
                  onChange={setAProp("bgField")}
                >
                  {options.fields
                    .filter(
                      (f) =>
                        f.type === "String" ||
                        (f.type && f.type.name === "String") ||
                        (f.type && f.type === "File")
                    )
                    .map((f, ix) => (
                      <option key={ix} value={f.name}>
                        {f.label}
                      </option>
                    ))}
                </select>
              </td>
            </tr>
          )}
          {(bgType === "Image" || bgType === "Image Field") && (
            <Fragment>
              <tr>
                <td>
                  <label>Size</label>
                </td>

                <td>
                  <select
                    value={imageSize}
                    className="form-control-sm  form-select"
                    onChange={setAProp("imageSize")}
                  >
                    {buildOptions(["contain", "cover", "repeat"])}
                  </select>
                </td>
              </tr>
              {imageSize !== "repeat" && (
                <tr>
                  <td>
                    <label>Responsive widths</label>
                  </td>

                  <td>
                    <input
                      type="text"
                      value={imgResponsiveWidths}
                      className="form-control"
                      onChange={setAProp("imgResponsiveWidths")}
                      spellCheck={false}
                    />
                    <small>
                      <i>
                        List of widths to serve resized images, e.g. 300, 400,
                        600
                      </i>
                    </small>
                  </td>
                </tr>
              )}
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
              type: "Font",
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
                  onChange={setAProp("setTextColor", { checked: true })}
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
      <table className="w-100" accordiontitle="Transform">
        <tbody>
          <SettingsRow
            field={{
              name: "rotate",
              label: "Rotate°",
              type: "Integer",
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ name: "skewX", label: "SkewX°", type: "Integer" }}
            node={node}
            setProp={setProp}
            subProp="transform"
            valuePostfix="deg"
          />
          <SettingsRow
            field={{ name: "skewY", label: "SkewY°", type: "Integer" }}
            node={node}
            setProp={setProp}
            subProp="transform"
            valuePostfix="deg"
          />
          <SettingsRow
            field={{ name: "scaleX", label: "ScaleX", type: "Float" }}
            node={node}
            setProp={setProp}
            subProp="transform"
          />
          <SettingsRow
            field={{ name: "scaleY", label: "ScaleY", type: "Float" }}
            node={node}
            setProp={setProp}
            subProp="transform"
          />
          <SettingsRow
            field={{
              name: "translateX",
              label: "TranslateX",
              type: "DimUnits",
            }}
            node={node}
            setProp={setProp}
            subProp="transform"
          />
          <SettingsRow
            field={{
              name: "translateY",
              label: "TranslateY",
              type: "DimUnits",
            }}
            node={node}
            setProp={setProp}
            subProp="transform"
          />
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
      <table className="w-100" accordiontitle="Animate">
        <tbody>
          <SettingsRow
            field={{
              name: "animateName",
              label: "Animation",
              type: "select",
              options: ["None", ...(options.keyframes || [])],
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "animateDuration",
              label: "Duration (s)",
              type: "Float",
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ name: "animateDelay", label: "Delay (s)", type: "Float" }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              name: "animateInitialHide",
              label: "Initially hidden",
              type: "Bool",
            }}
            node={node}
            setProp={setProp}
          />
        </tbody>
      </table>
      <table className="w-100" accordiontitle="Show if...">
        <tbody>
          {["show", "edit", "filter"].includes(options.mode) && (
            <SettingsSectionHeaderRow title="Formula - show if true" />
          )}
          {["show", "edit", "filter"].includes(options.mode) && (
            <tr>
              <td colSpan={2}>
                <input
                  type="text"
                  className="form-control text-to-display"
                  value={showIfFormula}
                  spellCheck={false}
                  onChange={setAProp("showIfFormula")}
                  onInput={(e) => validate_expression_elem($(e.target))}
                />
                <div style={{ marginTop: "-5px" }}>
                  <small className="text-muted font-monospace">
                    FORMULA <FormulaTooltip />
                  </small>
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
                    onChange={(e) => {
                      if (!e?.target) return;
                      const checked = e.target.checked;
                      setProp((prop) => {
                        if (!prop.showForRole || prop.showForRole.length === 0)
                          options.roles.forEach(
                            (r) => (prop.showForRole[r.id] = true)
                          );
                        prop.showForRole[id] = checked;
                      });
                    }}
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
                    onChange={setAProp("show_for_owner", { checked: true })}
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
                className="form-control form-select"
                onChange={setAProp("minScreenWidth")}
              >
                <option value="">all</option>
                {buildBootstrapOptions(["sm", "md", "lg", "xl"])}
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
                className="form-control form-select"
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
            spellCheck={false}
            value={url}
            onChange={setAProp("url")}
          />
        </OrFormula>
        {options.triggerActions ? (
          <Fragment>
            <label>Click action</label>
            <select
              value={click_action}
              className="form-control form-select"
              onChange={(e) => {
                if (!e.target) return;
                const value = e.target.value;
                setProp((prop) => {
                  prop.click_action = value;
                });
              }}
            >
              <option value="">None</option>
              {options.triggerActions.map((f, ix) => (
                <option key={ix} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Fragment>
        ) : null}
        <label>Hover color</label>
        <select
          value={hoverColor}
          className="form-control form-select"
          onChange={setAProp("hoverColor")}
        >
          <option value="">none</option>
          {buildOptions(["gray", "gray-dark", "light", "dark"], {
            valAttr: true,
          })}
        </select>
      </div>

      <div accordiontitle="Class, ID and CSS">
        <div>
          <label>ID</label>
        </div>
        <OrFormula nodekey="customId" {...{ setProp, isFormula, node }}>
          <input
            type="text"
            className="form-control text-to-display"
            value={customId}
            spellCheck={false}
            onChange={setAProp("customId")}
          />
        </OrFormula>
        <div>
          <label>Custom class</label>
        </div>
        <OrFormula nodekey="customClass" {...{ setProp, isFormula, node }}>
          <input
            type="text"
            className="form-control text-to-display"
            value={customClass}
            spellCheck={false}
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
          spellCheck={false}
        ></textarea>
      </div>
    </Accordion>
  );
};

/**
 * @type {object}
 */
Container.craft = {
  displayName: "Container",
  props: {
    minHeight: 0,
    vAlign: "top",
    hAlign: "left",
    bgFileId: 0,
    bgField: "",
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
