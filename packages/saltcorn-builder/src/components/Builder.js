import React, { useEffect, useContext, Fragment } from "react";
import { Editor, Frame, Canvas, Selector, useEditor } from "@craftjs/core";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { TwoSplit } from "./elements/TwoSplit";
import { Action } from "./elements/Action";
import { Empty } from "./elements/Empty";
import optionsCtx from "./context";
import { ToolboxShow, ToolboxEdit, ToolboxPage } from "./Toolbox";
import { craftToSaltcorn, layoutToNodes } from "./storage";

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
        isDeletable: query.node(currentNodeId).isDeletable()
      };
    }

    return {
      selected
    };
  });

  return (
    <div className="settings-panel">
      <h5>Settings</h5>
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
      Save
    </button>
  );
};

const Builder = ({ options, layout, mode }) => {
  return (
    <Editor>
      <Provider value={options}>
        <div className="row">
          <div className="col-sm-9">
            <h5>View canvas</h5>
            <Frame
              resolver={{
                Text,
                Empty,
                TwoSplit,
                JoinField,
                Field,
                ViewLink,
                Action
              }}
            >
              <Canvas className="canvas"></Canvas>
            </Frame>
          </div>
          <div className="col-sm-3">
            {mode === "show" ? (
              <ToolboxShow />
            ) : mode === "edit" ? (
              <ToolboxEdit />
            ) : mode === "page" ? (
              <ToolboxPage />
            ) : (
              <div>Missing mode</div>
            )}
            <SettingsPanel />
          </div>
        </div>
        <SaveButton layout={layout} />
      </Provider>
    </Editor>
  );
};

export default Builder;
