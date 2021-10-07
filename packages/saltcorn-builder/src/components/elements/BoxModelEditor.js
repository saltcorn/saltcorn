import React, { useContext, Fragment, useState } from "react";
import { SettingsRow } from "./utils";
/* 
Contains code from https://github.com/tpaksu/boxmodel
Copyright (c) 2017 Taha Paksu
*/
export const BoxModelEditor = ({ setProp, node }) => {
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
  console.log(style);
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
                    onClick={() => setSelectedCategory("border")}
                  >
                    Border
                  </span>
                  <span
                    className="boxmodel-input-container boxmodel-input-direction-left"
                    onClick={() => setCatAndDir("border", "left")}
                  >
                    <input
                      disabled
                      type="text"
                      autoComplete="off"
                      name="boxmodel-ex-1_left_border"
                      value={style["border-left"] || style["border"] || ""}
                      size="3"
                    />
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
                        value={style["border-top"] || style["border"] || ""}
                        size="3"
                      />
                    </span>
                    <div className="boxmodel-padding">
                      <span
                        className="boxmodel-text boxmodel-header"
                        onClick={() => setSelectedCategory("padding")}
                      >
                        Padding
                      </span>
                      <span className="boxmodel-input-container boxmodel-input-direction-left">
                        <input
                          disabled
                          type="text"
                          autoComplete="off"
                          name="boxmodel-ex-1_left_padding"
                          size="3"
                          className=""
                        />
                      </span>
                      <div className="flex-row">
                        <span className="boxmodel-input-container boxmodel-input-direction-top">
                          <input
                            disabled
                            type="text"
                            autoComplete="off"
                            name="boxmodel-ex-1_top_padding"
                            size="3"
                          />
                        </span>
                        <div className="boxmodel-content">
                          <input
                            disabled
                            type="text"
                            autoComplete="off"
                            name="boxmodel-ex-1_width"
                            size="3"
                          />
                          x
                          <input
                            disabled
                            type="text"
                            autoComplete="off"
                            name="boxmodel-ex-1_height"
                            size="3"
                          />
                        </div>
                        <span className="boxmodel-input-container boxmodel-input-direction-bottom">
                          <input
                            disabled
                            type="text"
                            autoComplete="off"
                            name="boxmodel-ex-1_bottom_padding"
                            size="3"
                          />
                        </span>
                      </div>
                      <span className="boxmodel-input-container boxmodel-input-direction-right">
                        <input
                          disabled
                          type="text"
                          autoComplete="off"
                          name="boxmodel-ex-1_right_padding"
                          size="3"
                        />
                      </span>
                    </div>
                    <span className="boxmodel-input-container boxmodel-input-direction-bottom">
                      <input
                        disabled
                        type="text"
                        autoComplete="off"
                        name="boxmodel-ex-1_bottom_border"
                        size="3"
                      />
                    </span>
                  </div>
                  <span className="boxmodel-input-container boxmodel-input-direction-right">
                    <input
                      disabled
                      type="text"
                      autoComplete="off"
                      name="boxmodel-ex-1_right_border"
                      size="3"
                    />
                  </span>
                </div>
                <span className="boxmodel-input-container boxmodel-input-direction-bottom">
                  <input
                    disabled
                    type="text"
                    autoComplete="off"
                    name="boxmodel-ex-1_bottom_margin"
                    size="3"
                  />
                </span>
              </div>
              <span className="boxmodel-input-container boxmodel-input-direction-right">
                <input
                  disabled
                  type="text"
                  autoComplete="off"
                  name="boxmodel-ex-1_right_margin"
                  size="3"
                />
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
          {selectedProperty && (
            <SettingsRow
              field={{
                name: selectedProperty,
                label: selectedProperty,
                type: "DimUnits",
              }}
              node={node}
              setProp={setProp}
              isStyle={true}
            />
          )}
          {!selectedProperty && (
            <tr>
              <td colSpan={2}>Click above to select a property to adjust </td>
            </tr>
          )}
        </tbody>
      </table>
    </Fragment>
  );
};
