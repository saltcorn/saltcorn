import React, {
  useEffect,
  useContext,
  useState,
  Fragment,
  useRef,
} from "react";
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
import { Tabs } from "./elements/Tabs";
import { Empty } from "./elements/Empty";
import { DropDownFilter } from "./elements/DropDownFilter";
import { ToggleFilter } from "./elements/ToggleFilter";
import optionsCtx from "./context";
import PreviewCtx from "./preview_context";
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
import { Layers } from "saltcorn-craft-layers-noeye";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faUndo,
  faRedo,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { Accordion, ErrorBoundary } from "./elements/utils";
import { InitNewElement, Library } from "./Library";
import { RenderNode } from "./RenderNode";
const { Provider } = optionsCtx;

const SettingsPanel = () => {
  const { actions, selected, query } = useEditor((state, query) => {
    const currentNodeId = state.events.selected;
    let selected;

    if (currentNodeId) {
      selected = {
        id: currentNodeId,
        name: state.nodes[currentNodeId].data.name,
        parent: state.nodes[currentNodeId].data.parent,
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
  const otherSibling = (offset) => {
    const siblings = query.node(selected.parent).childNodes();
    const sibIx = siblings.findIndex((sib) => sib === selected.id);
    return siblings[sibIx + offset];
  };
  const handleUserKeyPress = (event) => {
    const { keyCode, target } = event;
    if (target.tagName.toLowerCase() === "body" && selected) {
      //8 backsp, 46 del
      if ((keyCode === 8 || keyCode === 46) && selected.id === "ROOT") {
        deleteChildren();
      }
      if (keyCode === 8) {
        //backspace
        const prevSib = otherSibling(-1);
        const parent = selected.parent;
        deleteThis();
        if (prevSib) actions.selectNode(prevSib);
        else actions.selectNode(parent);
      }
      if (keyCode === 46) {
        //del
        const nextSib = otherSibling(1);
        deleteThis();
        if (nextSib) actions.selectNode(nextSib);
      }
      if (keyCode === 37 && selected.parent)
        //left
        actions.selectNode(selected.parent);

      if (keyCode === 39) {
        //right
        if (selected.children && selected.children.length > 0) {
          actions.selectNode(selected.children[0]);
        } else if (selected.displayName === "Columns") {
          const node = query.node(selected.id).get();
          const child = node?.data?.linkedNodes?.Col0;
          if (child) actions.selectNode(child);
        }
      }
      if (keyCode === 38 && selected.parent) {
        //up
        const prevSib = otherSibling(-1);
        if (prevSib) actions.selectNode(prevSib);
        event.preventDefault();
      }
      if (keyCode === 40 && selected.parent) {
        //down
        const nextSib = otherSibling(1);
        if (nextSib) actions.selectNode(nextSib);
        event.preventDefault();
      }
    }
  };
  useEffect(() => {
    window.addEventListener("keydown", handleUserKeyPress);
    return () => {
      window.removeEventListener("keydown", handleUserKeyPress);
    };
  }, [handleUserKeyPress]);
  const hasChildren =
    selected && selected.children && selected.children.length > 0;
  const deleteChildren = () => {
    selected.children.forEach((child) => {
      actions.delete(child);
    });
  };
  const recursivelyCloneToElems = (nodeId, ix) => {
    const {
      data: { type, props, nodes },
    } = query.node(nodeId).get();
    const children = (nodes || []).map(recursivelyCloneToElems);
    return React.createElement(
      type,
      { ...props, ...(typeof ix !== "undefined" ? { key: ix } : {}) },
      children
    );
  };
  const duplicate = () => {
    const {
      data: { parent },
    } = query.node(selected.id).get();
    const siblings = query.node(selected.parent).childNodes();
    const sibIx = siblings.findIndex((sib) => sib === selected.id);
    const elem = recursivelyCloneToElems(selected.id);
    //console.log(elem);
    actions.addNodeTree(
      query.parseReactElement(elem).toNodeTree(),
      parent || "ROOT",
      sibIx + 1
    );
  };
  return (
    <div className="settings-panel card mt-1">
      <div className="card-header px-2 py-1">
        {selected && selected.displayName ? (
          <Fragment>
            <b>{selected.displayName}</b> settings
          </Fragment>
        ) : (
          "Settings"
        )}
      </div>
      <div className="card-body p-2">
        {selected ? (
          <Fragment>
            {selected.isDeletable && (
              <button className="btn btn-sm btn-danger" onClick={deleteThis}>
                <FontAwesomeIcon icon={faTrashAlt} className="mr-1" />
                Delete
              </button>
            )}
            {hasChildren && !selected.isDeletable ? (
              <button
                className="btn btn-sm btn-danger"
                onClick={deleteChildren}
              >
                <FontAwesomeIcon icon={faTrashAlt} className="mr-1" />
                Delete contents
              </button>
            ) : (
              <button
                title="Duplicate element with its children"
                className="btn btn-sm btn-secondary ml-2"
                onClick={duplicate}
              >
                <FontAwesomeIcon icon={faCopy} className="mr-1" />
                Clone
              </button>
            )}
            <hr className="my-2" />
            {selected.settings && React.createElement(selected.settings)}
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
      className="btn btn-sm btn-outline-secondary mr-2 builder-save-ajax"
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
    <a target="_blank" className="d-block" href={`/page/${options.page_name}`}>
      View page in new tab &raquo;
    </a>
  ) : (
    ""
  );
};
const HistoryPanel = () => {
  const { canUndo, canRedo, actions } = useEditor((state, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));

  return (
    <Fragment>
      {canUndo && (
        <button
          className="btn btn-sm btn-secondary ml-2 mr-2"
          title="Undo"
          onClick={() => actions.history.undo()}
        >
          <FontAwesomeIcon icon={faUndo} />
        </button>
      )}
      {canRedo && (
        <button
          className="btn btn-sm btn-secondary"
          title="Redo"
          onClick={() => actions.history.redo()}
        >
          <FontAwesomeIcon icon={faRedo} />
        </button>
      )}
    </Fragment>
  );
};

const NextButton = ({ layout }) => {
  const { query, actions } = useEditor(() => {});
  const options = useContext(optionsCtx);

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
    <button className="btn btn-sm btn-primary builder-save" onClick={onClick}>
      {options.next_button_label || "Next"} &raquo;
    </button>
  );
};

const Builder = ({ options, layout, mode }) => {
  const [showLayers, setShowLayers] = useState(true);
  const [previews, setPreviews] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const nodekeys = useRef([]);

  return (
    <ErrorBoundary>
      <Editor onRender={RenderNode}>
        <Provider value={options}>
          <PreviewCtx.Provider
            value={{ previews, setPreviews, uploadedFiles, setUploadedFiles }}
          >
            <div className="row" style={{ marginTop: "-5px" }}>
              <div className="col-sm-auto left-builder-col">
                <div className="componets-and-library-accordion toolbox-card">
                  <InitNewElement nodekeys={nodekeys} />
                  <Accordion>
                    <div className="card mt-1" accordiontitle="Components">
                      {{
                        show: <ToolboxShow />,
                        edit: <ToolboxEdit />,
                        page: <ToolboxPage />,
                        filter: <ToolboxFilter />,
                      }[mode] || <div>Missing mode</div>}
                    </div>
                    <div accordiontitle="Library">
                      <Library />
                    </div>
                  </Accordion>
                </div>
                <div className="card toolbox-card pr-0">
                  <div className="card-header">Layers</div>
                  {showLayers && (
                    <div className="card-body p-0 builder-layers">
                      <Layers expandRootOnLoad={true} />
                    </div>
                  )}
                </div>
              </div>
              <div
                id="builder-main-canvas"
                className={`col builder-mode-${options.mode}`}
              >
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
                      Tabs,
                      ToggleFilter,
                    }}
                  >
                    <Element canvas is={Column}></Element>
                  </Frame>
                </div>
              </div>
              <div className="col-sm-auto builder-sidebar">
                <div style={{ width: "16rem" }}>
                  <SaveButton />
                  <NextButton layout={layout} />
                  <HistoryPanel />
                  <ViewPageLink />
                  <SettingsPanel />
                </div>
              </div>
            </div>
          </PreviewCtx.Provider>
        </Provider>
        <div className="d-none preview-scratchpad"></div>
      </Editor>
    </ErrorBoundary>
  );
};

export default Builder;
