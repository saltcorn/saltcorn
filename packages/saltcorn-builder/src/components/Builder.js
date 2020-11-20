import React, { useEffect, useContext, useState, Fragment } from "react";
import { Editor, Frame, Element, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { Columns } from "./elements/Columns";
import { SearchBar } from "./elements/SearchBar";
import { HTMLCode } from "./elements/HTMLCode";
import { Action } from "./elements/Action";
import { Image } from "./elements/Image";
import { Empty } from "./elements/Empty";
import { DropDownFilter } from "./elements/DropDownFilter";
import { ToggleFilter } from "./elements/ToggleFilter";
import optionsCtx from "./context";
import {
  ToolboxShow,
  ToolboxEdit,
  ToolboxPage,
  ToolboxFilter,
} from "./Toolbox";
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
        displayName:
          state.nodes[currentNodeId].data &&
          state.nodes[currentNodeId].data.displayName,
        settings:
          state.nodes[currentNodeId].related &&
          state.nodes[currentNodeId].related.settings,
        isDeletable: query.node(currentNodeId).isDeletable(),
        children:
          state.nodes[currentNodeId].data &&
          state.nodes[currentNodeId].data.nodes,
      };
    }

    return {
      selected,
    };
  });
  const deleteThis = () => {
    actions.delete(selected.id);
  };
  const hasChildren =
    selected && selected.children && selected.children.length > 0;
  const deleteChildren = () => {
    selected.children.forEach((child) => {
      actions.delete(child);
    });
  };
  return (
    <div className="settings-panel card mt-2">
      <div className="card-header">
        {selected && selected.displayName
          ? `Settings: ${selected.displayName}`
          : "Settings"}
      </div>
      <div className="card-body p-2">
        {selected ? (
          <Fragment>
            {}
            {selected.settings && React.createElement(selected.settings)}
            {selected.isDeletable && (
              <button className="btn btn-danger mt-2" onClick={deleteThis}>
                Delete
              </button>
            )}
            {hasChildren && !selected.isDeletable && (
              <button className="btn btn-danger mt-2" onClick={deleteChildren}>
                Delete contents
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
const SaveButton = () => {
  const { query, actions } = useEditor(() => {});
  const options = useContext(optionsCtx);

  const onClick = () => {
    const data = craftToSaltcorn(JSON.parse(query.serialize()));
    const urlroot = options.page_id ? "pageedit" : "viewedit";
    fetch(`/${urlroot}/savebuilder/${options.page_id || options.view_id}`, {
      method: "POST", // or 'PUT'
      headers: {
        "Content-Type": "application/json",
        "CSRF-Token": options.csrfToken,
      },
      body: JSON.stringify(data),
    });
  };
  return options.page_id || options.view_id ? (
    <button
      className="btn btn-outline-secondary mr-2 builder-save-ajax"
      onClick={onClick}
    >
      Save
    </button>
  ) : (
    ""
  );
};
const ViewPageLink = () => {
  const { query, actions } = useEditor(() => {});
  const options = useContext(optionsCtx);
  return options.page_id ? (
    <a
      target="_blank"
      className="d-block mt-2"
      href={`/page/${options.page_name}`}
    >
      View page
    </a>
  ) : (
    ""
  );
};
const NextButton = ({ layout }) => {
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
    <button className="btn btn-primary builder-save" onClick={onClick}>
      Next &raquo;
    </button>
  );
};

const Builder = ({ options, layout, mode }) => {
  const [showLayers, setShowLayers] = useState(true);

  return (
    <Editor>
      <Provider value={options}>
        <div className="row">
          <div className="col-sm-auto">
            <div className="card">
              {{
                show: <ToolboxShow />,
                edit: <ToolboxEdit />,
                page: <ToolboxPage />,
                filter: <ToolboxFilter />,
              }[mode] || <div>Missing mode</div>}
            </div>
          </div>
          <div id="builder-main-canvas" className="col">
            <div>
              <Frame
                resolver={{
                  Text,
                  Empty,
                  Columns,
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
                  DropDownFilter,
                  ToggleFilter,
                }}
              >
                <Element canvas is={Column}></Element>
              </Frame>
            </div>
          </div>
          <div className="col-sm-auto builder-sidebar">
            <div style={{ width: "16rem" }}>
              <div className="card">
                <div className="card-header">
                  Layers
                  <div className="float-right">
                    <input
                      type="checkbox"
                      checked={showLayers}
                      onChange={(e) => setShowLayers(e.target.checked)}
                    />
                  </div>
                </div>
                {showLayers && (
                  <div className="card-body p-0 builder-layers">
                    <Layers expandRootOnLoad={true} />
                  </div>
                )}
              </div>
              <SettingsPanel />
              <br />
              <SaveButton />
              <NextButton layout={layout} />
              <ViewPageLink />
            </div>
          </div>
        </div>
      </Provider>
    </Editor>
  );
};

export default Builder;
