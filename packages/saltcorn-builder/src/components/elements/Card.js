/**
 * @category saltcorn-builder
 * @module components/elements/Card
 * @subcategory components / elements
 */

import React, { Fragment, useContext } from "react";
import { Text } from "./Text";
import {
  OrFormula,
  SettingsRow,
  Accordion,
  reactifyStyles,
  SettingsSectionHeaderRow,
  setAPropGen,
  buildOptions,
} from "./utils";
import { Column } from "./Column";

import { Element, useNode } from "@craftjs/core";
import { BoxModelEditor } from "./BoxModelEditor";
import {
  AlignTop,
  AlignMiddle,
  AlignStart,
  AlignEnd,
  AlignCenter,
  AlignBottom,
  SlashCircle,
  Image,
  Images,
  Rainbow,
  Palette,
} from "react-bootstrap-icons";

import optionsCtx from "../context";
import previewCtx from "../preview_context";

import { bstyleopt } from "./utils";

export /**
 * @param {object} props
 * @param {string} props.children
 * @param {object} props.isFormula
 * @param {string} [props.title]
 * @param {string} props.shadow
 * @param {boolean} props.noPadding
 * @param {object} props.style
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const Card = ({
  children,
  isFormula,
  title,
  shadow,
  noPadding,
  style,
  footer,
  hasFooter,
  hAlign,
  bgType,
  bgColor,
  bgFileId,
  imageSize,
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
      className={`card ${shadow ? "shadow" : ""} text-${hAlign} builder ${
        selected ? "selected-node" : ""
      }`}
      style={{
        ...reactifyStyles(style),
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
      }}
      ref={(dom) => connect(drag(dom))}
    >
      {title && title.length > 0 && (
        <div className="card-header">
          {isFormula?.title ? (
            <span className="font-monospace">={title}</span>
          ) : (
            title
          )}
        </div>
      )}
      <div className={`card-body ${noPadding ? "p-0" : ""}`}>
        <div className="canvas">{children}</div>
      </div>
      {hasFooter ? (
        <div className={`card-footer ${noPadding ? "p-0" : ""}`}>
          <Element canvas id={`cardfooter`} is={Column}>
            {footer}
          </Element>
        </div>
      ) : null}
    </div>
  );
};

export /**
 * @returns {Accordion}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const CardSettings = () => {
  const node = useNode((node) => {
    const ps = {};
    fields.forEach((f) => {
      ps[f.name] = node.data.props[f.name];
    });
    if (fields.some((f) => f.canBeFormula))
      ps.isFormula = node.data.props.isFormula;
    return ps;
  });
  const {
    actions: { setProp },
    bgType,
    gradStartColor,
    gradEndColor,
    gradDirection,
    bgFileId,
    bgField,
    imageSize,
    imgResponsiveWidths,
    bgColor,
    isFormula,
  } = node;
  const options = useContext(optionsCtx);
  const { uploadedFiles } = useContext(previewCtx);
  const setAProp = setAPropGen(setProp);

  return (
    <Accordion>
      <table className="w-100" accordiontitle="Card properties">
        <tbody>
          <SettingsRow
            field={{
              label: "Card title",
              name: "title",
              type: "String",
              canBeFormula: true,
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              label: "URL",
              name: "url",
              type: "String",
              canBeFormula: true,
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              label: "Class",
              name: "class",
              type: "String",
              canBeFormula: true,
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ label: "Card footer", name: "hasFooter", type: "Bool" }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ label: "Shadow", name: "shadow", type: "Bool" }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{
              label: "Save indicator",
              name: "titleAjaxIndicator",
              type: "Bool",
            }}
            node={node}
            setProp={setProp}
          />
          <SettingsRow
            field={{ label: "No padding", name: "noPadding", type: "Bool" }}
            node={node}
            setProp={setProp}
          />
        </tbody>
      </table>
      <div accordiontitle="Box" className="w-100">
        <BoxModelEditor setProp={setProp} node={node} sizeWithStyle={true} />
      </div>
      <table className="w-100" accordiontitle="Contents">
        <tbody>
          <SettingsSectionHeaderRow title="Align" />
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
        </tbody>
      </table>
    </Accordion>
  );
};

const fields = [
  {
    label: "Card title",
    name: "title",
    type: "String",
    canBeFormula: true,
  },
  { label: "URL", name: "url", type: "String", canBeFormula: true },
  { label: "Class", name: "class", type: "String", canBeFormula: true },
  { label: "Shadow", name: "shadow", type: "Bool" },
  { label: "Card footer", name: "hasFooter", type: "Bool" },
  { label: "Save indicator", name: "titleAjaxIndicator", type: "Bool" },
  { label: "No padding", name: "noPadding", type: "Bool" },
  { label: "Footer", name: "footer", type: "Nodes", nodeID: "cardfooter" },
  { name: "style", default: {} },
  { label: "Class", name: "class", type: "String", canBeFormula: true },
  { name: "hAlign" },
  { name: "bgType" },
  { name: "gradStartColor" },
  { name: "gradEndColor" },
  { name: "gradDirection" },
  { name: "bgFileId" },
  { name: "bgField" },
  { name: "imageSize" },
  { name: "imgResponsiveWidths" },
  { name: "bgColor" },
];

/**
 * @type {object}
 */
Card.craft = {
  props: {
    title: "",
    url: "",
    class: "",
    shadow: true,
    isFormula: {},
    style: {},
    footer: [],
  },
  displayName: "Card",
  related: {
    settings: CardSettings,
    segment_type: "card",
    hasContents: true,
    fields,
  },
};
