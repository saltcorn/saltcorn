import React, { useEffect, useContext, Fragment } from "react";
import { Editor, Frame, Element, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { TwoSplit } from "./elements/TwoSplit";
import { SearchBar } from "./elements/SearchBar";
import { HTMLCode } from "./elements/HTMLCode";
import { Action } from "./elements/Action";
import { Image } from "./elements/Image";
import { Empty } from "./elements/Empty";
import optionsCtx from "./context";
import { ToolboxShow, ToolboxEdit, ToolboxPage } from "./Toolbox";
import { craftToSaltcorn, layoutToNodes } from "./storage";
import { Card } from "./elements/Card";
import { Link } from "./elements/Link";
import { View } from "./elements/View";
import { Container } from "./elements/Container";
import { Column } from "./elements/Column";
import { Layers } from "@craftjs/layers";

const { Provider } = optionsCtx;

const SettingsPanel = () => {
  const { actions, selected } = useEditor((state, query) => {
    const currentNodeId = state.events.selected;
    let selected;

    if (currentNodeId) {
      selected = {
        id: currentNodeId,
        name: state.nodes[currentNodeId].data.name,
        settings:
          state.nodes[currentNodeId].related &&
          state.nodes[currentNodeId].related.settings,
        isDeletable: query.node(currentNodeId).isDeletable(),
      };
    }

    return {
      selected,
    };
  });

  return (
    <div className="settings-panel card">
      <div className="card-header">Settings</div>
      <div className="card-body">
        {selected ? (
          <Fragment>
            {selected.settings && React.createElement(selected.settings)}
            {selected.isDeletable && (
              <button
                onClick={() => {
                  actions.delete(selected.id);
                }}
              >
                Delete
              </button>
            )}
          </Fragment>
        ) : (
          "No element selected"
        )}
      </div>
    </div>
  );
};

const SaveButton = ({ layout }) => {
  const { query, actions } = useEditor(() => {});
  useEffect(() => {
    layoutToNodes(layout, query, actions);
  }, []);
  const onClick = () => {
    const { columns, layout } = craftToSaltcorn(JSON.parse(query.serialize()));
    document
      .querySelector("form#scbuildform input[name=columns]")
      .setAttribute("value", encodeURIComponent(JSON.stringify(columns)));
    document
      .querySelector("form#scbuildform input[name=layout]")
      .setAttribute("value", encodeURIComponent(JSON.stringify(layout)));
    document.getElementById("scbuildform").submit();
  };
  return (
    <button className="btn btn-primary" onClick={onClick}>
      Next &raquo;
    </button>
  );
};

const Builder = ({ options, layout, mode }) => {
  return (
    <Editor>
      <Provider value={options}>
        <div className="row">
          <div className="col-sm-auto">
            {mode === "show" ? (
              <ToolboxShow />
            ) : mode === "edit" ? (
              <ToolboxEdit />
            ) : mode === "page" ? (
              <ToolboxPage />
            ) : (
              <div>Missing mode</div>
            )}
          </div>
          <div className="col">
            <div>
              <Frame
                resolver={{
                  Text,
                  Empty,
                  TwoSplit,
                  JoinField,
                  Field,
                  ViewLink,
                  Action,
                  HTMLCode,
                  LineBreak,
                  Aggregation,
                  Card,
                  Image,
                  Link,
                  View,
                  SearchBar,
                  Container,
                  Column,
                }}
              >
                <Element canvas is={Column}></Element>
              </Frame>
            </div>
          </div>
          <div className="col-sm-auto">
            <div style={{ width: "13rem" }}>
              <div className="card p-2">
                <div className="card-header">Layers</div>
                <Layers expandRootOnLoad={true} />
              </div>
              <SettingsPanel />
              <br />
              <SaveButton layout={layout} />
            </div>
          </div>
        </div>
      </Provider>
    </Editor>
  );
};

export default Builder;
