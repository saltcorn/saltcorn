import React, { useContext, Fragment } from "react";

export const BoxModelEditor = ({ setProp, node }) => {
  return (
    <div className="boxmodel-container boxmodel-chrome-skin mt-2 mx-auto">
      <div className="boxmodel-container">
        <div className="boxmodel-margin">
          <span className="boxmodel-text boxmodel-header">Margin</span>
          <span className="boxmodel-input-container boxmodel-input-direction-left">
            <input
              disabled
              type="text"
              autoComplete="off"
              name="boxmodel-ex-1_left_margin"
              size="3"
            />
          </span>
          <div className="flex-row">
            <span className="boxmodel-input-container boxmodel-input-direction-top">
              <input
                disabled
                type="text"
                autoComplete="off"
                name="boxmodel-ex-1_top_margin"
                size="3"
              />
            </span>
            <div className="boxmodel-border">
              <span className="boxmodel-text boxmodel-header">Border</span>
              <span className="boxmodel-input-container boxmodel-input-direction-left">
                <input
                  disabled
                  type="text"
                  autoComplete="off"
                  name="boxmodel-ex-1_left_border"
                  size="3"
                />
              </span>
              <div className="flex-row">
                <span className="boxmodel-input-container boxmodel-input-direction-top">
                  <input
                    disabled
                    type="text"
                    autoComplete="off"
                    name="boxmodel-ex-1_top_border"
                    size="3"
                  />
                </span>
                <div className="boxmodel-padding">
                  <span className="boxmodel-text boxmodel-header">Padding</span>
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
  );
};
