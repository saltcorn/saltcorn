/**
 * @category saltcorn-builder
 * @module components/elements/BoxModelEditor
 * @subcategory components / elements
 */

import React, { useContext, Fragment, useState } from "react";
import { SettingsRow, SettingsSectionHeaderRow, bstyleopt } from "./utils";
/* 
Contains code from https://github.com/tpaksu/boxmodel
Copyright (c) 2017 Taha Paksu
*/

export /**
 *
 * @param {object} props
 * @param {function} props.setProp
 * @param {object} props.node
 * @returns {Fragment}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const BoxModelEditor = ({ setProp, node, sizeWithStyle }) => {
  const [selectedCategory, setSelectedCategory] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState(false);
  const selectedProperty = !selectedCategory
    ? false
    : selectedDirection
    ? `${selectedCategory}-${selectedDirection}`
    : selectedCategory;
  const setCatAndDir = (c, d) => {
    setSelectedCategory(c);
    setSelectedDirection(d);
  };
  //console.log(node.style);
  const style = node.style;
  return (
    <Fragment>
      <div className="w-100 text-center">
        <div className="boxmodel-container boxmodel-chrome-skin mt-2 mx-auto text-center">
          <div className="boxmodel-container">
            <div className="boxmodel-margin">
              <span
                className="boxmodel-text boxmodel-header"
                onClick={() => setCatAndDir("margin", null)}
              >
                Margin
              </span>
              <span
                className="boxmodel-input-container boxmodel-input-direction-left"
                onClick={() => setCatAndDir("margin", "left")}
              >
                <div className="rotate dim-display">
                  {style["margin-left"] || style["margin"] || ""}
                </div>
              </span>
              <div className="flex-row">
                <span
                  className="boxmodel-input-container boxmodel-input-direction-top"
                  onClick={() => setCatAndDir("margin", "top")}
                >
                  <input
                    disabled
                    type="text"
                    autoComplete="off"
                    name="boxmodel-ex-1_top_margin"
                    size="3"
                    value={style["margin-top"] || style["margin"] || ""}
                  />
                </span>
                <div className="boxmodel-border">
                  <span
                    className="boxmodel-text boxmodel-header"
                    onClick={() => setCatAndDir("border", null)}
                  >
                    Border
                  </span>
                  <span
                    className="boxmodel-input-container boxmodel-input-direction-left"
                    onClick={() => setCatAndDir("border", "left")}
                  >
                    <div className="rotate dim-display">
                      {style["border-left-width"] ||
                        style["border-width"] ||
                        ""}
                    </div>
                  </span>
                  <div className="flex-row">
                    <span
                      className="boxmodel-input-container boxmodel-input-direction-top"
                      onClick={() => setCatAndDir("border", "top")}
                    >
                      <input
                        disabled
                        type="text"
                        autoComplete="off"
                        name="boxmodel-ex-1_top_border"
                        value={
                          style["border-top-width"] ||
                          style["border-width"] ||
                          ""
                        }
                        size="3"
                      />
                    </span>
                    <div className="boxmodel-padding">
                      <span
                        className="boxmodel-text boxmodel-header"
                        onClick={() => setCatAndDir("padding", null)}
                      >
                        Padding
                      </span>
                      <span
                        className="boxmodel-input-container boxmodel-input-direction-left"
                        onClick={() => setCatAndDir("padding", "left")}
                      >
                        <div className="rotate dim-display-padding">
                          {style["padding-left"] || style["padding"] || ""}
                        </div>
                      </span>
                      <div className="flex-row">
                        <span
                          className="boxmodel-input-container boxmodel-input-direction-top"
                          onClick={() => setCatAndDir("padding", "top")}
                        >
                          <input
                            disabled
                            type="text"
                            autoComplete="off"
                            name="boxmodel-ex-1_top_padding"
                            value={
                              style["padding-top"] || style["padding"] || ""
                            }
                            size="3"
                          />
                        </span>
                        <div
                          className="boxmodel-content"
                          onClick={() => setSelectedCategory("size")}
                        >
                          <input
                            disabled
                            type="text"
                            autoComplete="off"
                            name="boxmodel-ex-1_width"
                            size="3"
                            value={
                              sizeWithStyle
                                ? style["width"]
                                : node.width
                                ? `${node.width}${node.widthUnits || "px"}`
                                : ""
                            }
                          />
                          x
                          <input
                            disabled
                            type="text"
                            autoComplete="off"
                            name="boxmodel-ex-1_height"
                            size="3"
                            value={
                              sizeWithStyle
                                ? style["height"]
                                : node.height
                                ? `${node.height}${node.heightUnits || "px"}`
                                : ""
                            }
                          />
                        </div>
                        <span
                          className="boxmodel-input-container boxmodel-input-direction-bottom"
                          onClick={() => setCatAndDir("padding", "bottom")}
                        >
                          <input
                            disabled
                            type="text"
                            autoComplete="off"
                            name="boxmodel-ex-1_bottom_padding"
                            size="3"
                            value={
                              style["padding-bottom"] || style["padding"] || ""
                            }
                          />
                        </span>
                      </div>
                      <span
                        className="boxmodel-input-container boxmodel-input-direction-right"
                        onClick={() => setCatAndDir("padding", "right")}
                      >
                        <div className="rotate dim-display-padding">
                          {style["padding-right"] || style["padding"] || ""}
                        </div>
                      </span>
                    </div>
                    <span
                      className="boxmodel-input-container boxmodel-input-direction-bottom"
                      onClick={() => setCatAndDir("border", "bottom")}
                    >
                      <input
                        disabled
                        type="text"
                        autoComplete="off"
                        name="boxmodel-ex-1_bottom_border"
                        size="3"
                        value={
                          style["border-bottom-width"] ||
                          style["border-width"] ||
                          ""
                        }
                      />
                    </span>
                  </div>
                  <span
                    className="boxmodel-input-container boxmodel-input-direction-right"
                    onClick={() => setCatAndDir("border", "right")}
                  >
                    <div className="rotate dim-display">
                      {style["border-right-width"] ||
                        style["border-width"] ||
                        ""}
                    </div>
                  </span>
                </div>
                <span
                  className="boxmodel-input-container boxmodel-input-direction-bottom"
                  onClick={() => setCatAndDir("margin", "bottom")}
                >
                  <input
                    disabled
                    type="text"
                    autoComplete="off"
                    name="boxmodel-ex-1_bottom_margin"
                    size="3"
                    value={style["margin-bottom"] || style["margin"] || ""}
                  />
                </span>
              </div>
              <span
                className="boxmodel-input-container boxmodel-input-direction-right"
                onClick={() => setCatAndDir("margin", "right")}
              >
                <div className="rotate dim-display">
                  {style["margin-right"] || style["margin"] || ""}
                </div>
              </span>
            </div>
          </div>
        </div>
      </div>
      <table className="w-100 mt-2">
        <tbody>
          <tr>
            <td width="45%"></td>
            <td></td>
          </tr>
          {selectedProperty &&
            ["margin", "padding"].includes(selectedCategory) && (
              <SettingsRow
                field={{
                  name: selectedProperty,
                  label: selectedProperty,
                  type: "DimUnits",
                  autoable: selectedCategory === "margin",
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
            )}
          {selectedCategory === "size" && (
            <Fragment>
              <SettingsRow
                field={{ name: "width", label: "width", type: "DimUnits" }}
                node={node}
                setProp={setProp}
                isStyle={!!sizeWithStyle}
              />
              <SettingsRow
                field={{ name: "height", label: "height", type: "DimUnits" }}
                node={node}
                setProp={setProp}
                isStyle={!!sizeWithStyle}
              />
              <SettingsRow
                field={{
                  name: sizeWithStyle ? "min-height" : "minHeight",
                  label: "min height",
                  type: "DimUnits",
                }}
                node={node}
                setProp={setProp}
                isStyle={!!sizeWithStyle}
              />
            </Fragment>
          )}
          {selectedCategory === "border" && (
            <Fragment>
              <SettingsSectionHeaderRow title={selectedProperty} />
              <SettingsRow
                field={{
                  name: selectedProperty + "-width",
                  label: "width",
                  type: "DimUnits",
                }}
                node={node}
                setProp={setProp}
                isStyle={true}
              />
              <SettingsRow
                field={{
                  name: selectedProperty + "-style",
                  label: "style",
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
                isStyle={true}
                setProp={setProp}
              />
              <SettingsRow
                field={{
                  name: selectedProperty + "-color",
                  label: "color",
                  type: "Color",
                }}
                node={node}
                isStyle={true}
                setProp={setProp}
              />
              {!selectedDirection && (
                <SettingsRow
                  field={{
                    name: selectedProperty + "-radius",
                    label: "radius",
                    type: "DimUnits",
                  }}
                  node={node}
                  setProp={setProp}
                  isStyle={true}
                />
              )}
              {selectedDirection &&
                radiusCornerDirections[selectedDirection].map((corner, ix) => (
                  <SettingsRow
                    key={ix}
                    field={{
                      name: `border-${corner}-radius`,
                      label: corner.replace("-", " ") + " radius",
                      type: "DimUnits",
                    }}
                    node={node}
                    setProp={setProp}
                    isStyle={true}
                  />
                ))}
            </Fragment>
          )}
          {!selectedProperty && (
            <tr>
              <td colSpan={2}>
                <div>Click above to select a property to adjust.</div>
                <div>
                  <small>
                    Click a label (margin, border, padding) to adjust all edges.
                  </small>
                </div>
                <div>
                  <small>Click an edge to adjust that edge.</small>
                </div>
                <div>
                  <small>Click center to adjust height and width</small>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Fragment>
  );
};
const radiusCornerDirections = {
  left: ["bottom-left", "top-left"],
  right: ["bottom-right", "top-right"],
  top: ["top-left", "top-right"],
  bottom: ["bottom-left", "bottom-right"],
};
