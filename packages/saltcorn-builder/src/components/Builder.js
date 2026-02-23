/**
 * @category saltcorn-builder
 * @module components/Builder
 * @subcategory components
 */

import React, {
  useEffect,
  useContext,
  useState,
  Fragment,
  useRef,
  memo,
} from "react";
import useTranslation from "../hooks/useTranslation";
import { Editor, Frame, Element, Selector, useEditor, DefaultEventHandlers } from "@craftjs/core";
import { Layers, useLayer } from "@craftjs/layers"
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { JoinField } from "./elements/JoinField";
import { Aggregation } from "./elements/Aggregation";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { Columns, ntimes } from "./elements/Columns";
import { SearchBar } from "./elements/SearchBar";
import { HTMLCode } from "./elements/HTMLCode";
import { Action } from "./elements/Action";
import { Image } from "./elements/Image";
import { Tabs } from "./elements/Tabs";
import { Table } from "./elements/Table";
import { Empty } from "./elements/Empty";
import { DropDownFilter } from "./elements/DropDownFilter";
import { DropMenu } from "./elements/DropMenu";
import { ToggleFilter } from "./elements/ToggleFilter";
import optionsCtx from "./context";
import PreviewCtx from "./preview_context";
import RelationsCtx from "./relations_context";
import StorageCtx from "./storage_context";
import {
  ToolboxShow,
  ToolboxEdit,
  ToolboxPage,
  ToolboxFilter,
  ToolboxList,
} from "./Toolbox";
import { craftToSaltcorn, layoutToNodes } from "./storage";
import { Card } from "./elements/Card";
import { Link } from "./elements/Link";
import { View } from "./elements/View";
import { Container } from "./elements/Container";
import { Column } from "./elements/Column";
// import { Layers } from "saltcorn-craft-layers-noeye";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faUndo,
  faRedo,
  faTrashAlt,
  faSave,
  faExclamationTriangle,
  faPlus,
  faChevronDown,
  faChevronUp
} from "@fortawesome/free-solid-svg-icons";
import {
  faCaretSquareLeft,
  faCaretSquareRight,
} from "@fortawesome/free-regular-svg-icons";
import { Accordion, ErrorBoundary } from "./elements/utils";
import { InitNewElement, Library, LibraryElem } from "./Library";
import { RenderNode } from "./RenderNode";
import { ListColumn } from "./elements/ListColumn";
import { ListColumns } from "./elements/ListColumns";
import { recursivelyCloneToElems } from "./elements/Clone";

const { Provider } = optionsCtx;

const getSelectedNodes = (selected) => {
  if (!selected) return [];
  if (typeof selected.all === "function") {
    return selected.all();
  }
  if (Array.isArray(selected.all)) {
    return selected.all;
  }
  if (typeof selected.values === "function") {
    return Array.from(selected.values());
  }
  if (typeof selected.has === "function") {
    return [...selected];
  }
  return [selected];
};

const getFirstSelected = (selected) => {
  const nodes = getSelectedNodes(selected);
  return nodes.length > 0 ? nodes[0] : null;
};

/**
 *
 * @returns {div}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const SettingsPanel = () => {
  const { t } = useTranslation();
  const options = useContext(optionsCtx);

  const { actions, selected, selectedCount, query } = useEditor((state, query) => {
    const selectedNodes = getSelectedNodes(state.events.selected);
    const currentNodeId = selectedNodes.length === 1 ? selectedNodes[0] : null;
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
      selectedCount: selectedNodes.length,
    };
  });

  /** */
  const deleteThis = () => {
    actions.delete(selected.id);
  };

  /**
   * @param {number} offset
   * @returns {NodeId}
   */
  const otherSibling = (offset) => {
    const siblings = query.node(selected.parent).childNodes();
    const sibIx = siblings.findIndex((sib) => sib === selected.id);
    return siblings[sibIx + offset];
  };

  /**
   * @param {object} event
   */
  const handleUserKeyPress = (event) => {
    const { keyCode, target } = event;
    const tagName = target.tagName.toLowerCase();
    const hasSelection = selectedCount > 0;
    if ((tagName === "body" || tagName === "button") && hasSelection) {
      if (selected) {
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
      if ((event.ctrlKey || event.metaKey) && event.keyCode == 67) {
        const serialized = JSON.parse(query.serialize());
        const serializedIds = new Set(Object.keys(serialized));
        const currentSelected = query.getEvent("selected");
        const rawSelected = getSelectedNodes(currentSelected);
        if (rawSelected.length === 0 && selected?.id) rawSelected.push(selected.id);
        const selectedNodes = rawSelected
          .map((nodeId) => (typeof nodeId === "string" ? nodeId : nodeId?.id))
          .filter(
            (nodeId) =>
              nodeId && nodeId !== "ROOT" && serializedIds.has(nodeId)
          );
        if (selectedNodes.length === 0) return;

        if (selectedNodes.length === 1) {
          const { layout } = craftToSaltcorn(
            serialized,
            selectedNodes[0],
            options
          );
          navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
        } else {
          const layouts = selectedNodes.map((nodeId) => {
            const { layout } = craftToSaltcorn(
              serialized,
              nodeId,
              options
            );
            return layout;
          });
          navigator.clipboard.writeText(
            JSON.stringify({ above: layouts }, null, 2)
          );
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.keyCode == 88) {
        const serialized = JSON.parse(query.serialize());
        const serializedIds = new Set(Object.keys(serialized));
        const currentSelected = query.getEvent("selected");
        const rawSelected = getSelectedNodes(currentSelected);
        if (rawSelected.length === 0 && selected?.id) rawSelected.push(selected.id);
        const selectedNodes = rawSelected
          .map((nodeId) => (typeof nodeId === "string" ? nodeId : nodeId?.id))
          .filter(
            (nodeId) =>
              nodeId && nodeId !== "ROOT" && serializedIds.has(nodeId)
          );
        if (selectedNodes.length === 0) return;

        if (selectedNodes.length === 1) {
          const { layout } = craftToSaltcorn(
            serialized,
            selectedNodes[0],
            options
          );
          navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
          actions.delete(selectedNodes[0]);
        } else {
          const layouts = selectedNodes.map((nodeId) => {
            const { layout } = craftToSaltcorn(
              serialized,
              nodeId,
              options
            );
            return layout;
          });
          navigator.clipboard.writeText(
            JSON.stringify({ above: layouts }, null, 2)
          );
          selectedNodes.forEach((nodeId) => actions.delete(nodeId));
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.keyCode == 86) {
        navigator.clipboard.readText().then((clipText) => {
          const layout = JSON.parse(clipText);
          layoutToNodes(
            layout,
            query,
            actions,
            selected?.id || "ROOT",
            options
          );
        });
      }
      if ((event.ctrlKey || event.metaKey) && event.keyCode == 90) {
        // undo
        actions.history.undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.keyCode == 89) {
        // redo
        actions.history.redo();
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

  /**
   * @returns {void}
   */
  const deleteChildren = () => {
    selected.children.forEach((child) => {
      actions.delete(child);
    });
  };

  /**
   * @returns {void}
   */
  const duplicate = () => {
    const {
      data: { parent },
    } = query.node(selected.id).get();
    const siblings = query.node(selected.parent).childNodes();
    const sibIx = siblings.findIndex((sib) => sib === selected.id);
    const elem = recursivelyCloneToElems(query)(selected.id);
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
          t("Settings")
        )}
      </div>
      <div className="card-body p-2">
        {selectedCount > 1 ? (
          <div>
            <p><strong>{selectedCount} {t("elements selected")}</strong></p>
            <p className="text-muted small">{t("Multi-selection active. Use Shift+Click to add/remove elements.")}</p>
          </div>
        ) : selected ? (
          <Fragment>
            {selected.isDeletable && (
              <button
                className="btn btn-sm btn-danger delete-element-builder"
                onClick={deleteThis}
              >
                <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
                {t("Delete")}
              </button>
            )}
            {hasChildren && !selected.isDeletable ? (
              <button
                className="btn btn-sm btn-danger delete-children-builder"
                onClick={deleteChildren}
              >
                <FontAwesomeIcon icon={faTrashAlt} className="me-1" />
                {t("Delete contents")}
              </button>
            ) : (
              <button
                title={t("Duplicate element with its children")}
                className="btn btn-sm btn-secondary ms-2 duplicate-element-builder"
                onClick={duplicate}
              >
                <FontAwesomeIcon icon={faCopy} className="me-1" />
                {t("Clone")}
              </button>
            )}
            <hr className="my-2" />
            {selected.settings && React.createElement(selected.settings)}
          </Fragment>
        ) : (
          t("No element selected")
        )}
      </div>
    </div>
  );
};

// https://stackoverflow.com/questions/36862334/get-viewport-window-height-in-reactjs
function getWindowDimensions() {
  const { innerWidth: windowWidth, innerHeight: windowHeight } = window;
  return {
    windowWidth,
    windowHeight,
  };
}

function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(
    getWindowDimensions()
  );

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowDimensions;
}

/**
 * Custom Layer Component for Craft.js Layers panel
 * Must be defined outside Builder component and memoized to prevent infinite re-renders
 * Added defensive checks for layer properties
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */

const hiddenColumnParents = new Set(["Card", "Container", "Tabs", "Table"]);

const CustomLayerComponent = memo(({ children }) => {
  const {
    id,
    depth,
    expanded,
    hovered,
    actions: { toggleLayer, setExpandedState },
    connectors: { layer, drag, layerHeader },
  } = useLayer((layer) => {
      return {
        hovered: layer?.event?.hovered,
        expanded: layer?.expanded,
      };
  });

  const { displayName, hasNodes, isHiddenColumn, connectors: editorConnectors } = useEditor((state) => {
      const node = state.nodes[id];
      const data = node?.data;

      let name = data?.displayName || data?.name || id;
      if (name === "ROOT" || name === "Canvas") {
          name = data?.name || name;
      }

      const nodes = data?.nodes;
      const linkedNodes = data?.linkedNodes;
      const hasChildren = (nodes && nodes.length > 0) || (linkedNodes && Object.keys(linkedNodes).length > 0);

      // Check if this Column is a linked node of a Card/Container/Tabs/Table
      let shouldHide = false;
      if (name === "Column" && data?.parent) {
          const parentNode = state.nodes[data.parent];
          const parentName = parentNode?.data?.displayName || parentNode?.data?.name;
          if (hiddenColumnParents.has(parentName)) {
              const parentLinked = parentNode?.data?.linkedNodes;
              if (parentLinked && Object.values(parentLinked).includes(id)) {
                  shouldHide = true;
              }
          }
      }

      return {
          displayName: name,
          hasNodes: hasChildren,
          isHiddenColumn: shouldHide
      };
  });

  // Auto-expand hidden linked-node Columns so their children are always
  // visible through the transparent wrapper. Uses setExpandedState(true)
  // instead of toggleLayer() — it's idempotent (no-op when already true),
  // so it won't conflict with craft.js internals or cause toggle loops.
  useEffect(() => {
    if (isHiddenColumn && !expanded) {
      setExpandedState(true);
    }
  }, [isHiddenColumn, expanded, setExpandedState]);

  if (isHiddenColumn) {
    return (
      <div
        ref={(dom) => { layer(dom); if (dom) editorConnectors.drop(dom, id); }}
        style={{ marginLeft: "-20px" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={(dom) => { layer(dom); if (dom) editorConnectors.drop(dom, id); }}>
        <div
          ref={(dom) => { drag(dom); layerHeader(dom); }}
          className={`builder-layer-node ${hovered ? "hovered" : ""}`}
          style={{
            paddingLeft: `${depth * 20 + 10}px`,
          }}
        >
          <span className="layer-name" style={{ flexGrow: 1 }}>{displayName}</span>

          {hasNodes && (
             <span
               onClick={(e) => {
                 e.stopPropagation();
                 toggleLayer();
               }}
             >
               <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} fontSize={14} className="float-end fa-lg" />
             </span>
          )}
        </div>
      {children}
    </div>
  );
});

const AddColumnButton = () => {
  const { t } = useTranslation();
  const { query, actions } = useEditor(() => {});
  const options = useContext(optionsCtx);
  const addColumn = () => {
    actions.addNodeTree(
      query.parseReactElement(<ListColumn />).toNodeTree(),
      "ROOT"
    );
  };
  return (
    <button
      className="btn btn-primary mt-2 add-column-builder"
      onClick={addColumn}
    >
      <FontAwesomeIcon icon={faPlus} className="me-2" />
      {t("Add column")}
    </button>
  );
};

/**
 * @returns {Fragment}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const HistoryPanel = () => {
  const { t } = useTranslation();
  const { canUndo, canRedo, actions } = useEditor((state, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));

  return (
    <Fragment>
      {canUndo && (
        <button
          className="btn btn-sm btn-secondary ms-2 me-2 undo-builder"
          title={t("Undo")}
          onClick={() => actions.history.undo()}
        >
          <FontAwesomeIcon icon={faUndo} />
        </button>
      )}
      {canRedo && (
        <button
          className="btn btn-sm btn-secondary redo-builder"
          title={t("Redo")}
          onClick={() => actions.history.redo()}
        >
          <FontAwesomeIcon icon={faRedo} />
        </button>
      )}
    </Fragment>
  );
};

/**
 * @param {object} opts
 * @param {object} opts.layout
 * @returns {button}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */
const NextButton = ({ layout }) => {
  const { query, actions } = useEditor(() => {});
  const options = useContext(optionsCtx);

  useEffect(() => {
    layoutToNodes(layout, query, actions, "ROOT", options);
  }, []);

  /**
   * @returns {void}
   */
  const onClick = () => {
    const { columns, layout } = craftToSaltcorn(
      JSON.parse(query.serialize()),
      "ROOT",
      options
    );
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

/**
 * @param {object} props
 * @param {object} props.options
 * @param {object} props.layout
 * @param {string} props.mode
 * @returns {ErrorBoundary}
 * @category saltcorn-builder
 * @subcategory components
 * @namespace
 */


const Builder = ({ options, layout, mode }) => {
  const { t } = useTranslation();
  const [showLayers, setShowLayers] = useState(true);
  const [previews, setPreviews] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const nodekeys = useRef([]);
  const [savingState, setSavingState] = useState({ isSaving: false });
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [isLeftEnlarged, setIsLeftEnlarged] = useState(false);
  const [relationsCache, setRelationsCache] = useState({});
  const { windowWidth, windowHeight } = useWindowDimensions();

  const [builderHeight, setBuilderHeight] = useState(0);
  const [builderTop, setBuilderTop] = useState(0);

  const ref = useRef(null);

   useEffect(() => {
     if (!ref.current) return;
     setBuilderHeight(ref.current.clientHeight);
     const rect = ref.current.getBoundingClientRect();
     setBuilderTop(rect.top);
   });

  const canvasHeight =
    Math.max(windowHeight - builderTop, builderHeight, 600) - 10;
  return (
    <ErrorBoundary>
      <Editor
        onRender={RenderNode}
        indicator={{
          success: "#28a745",
          thickness: 2,
          className: "builder-drop-indicator",
        }}
        handlers={(store) => new DefaultEventHandlers({
          store,
          isMultiSelectEnabled: (e) => e?.shiftKey || false
        })}
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
          DropMenu,
          Tabs,
          Table,
          ToggleFilter,
          ListColumn,
          ListColumns,
          LibraryElem,
        }}
      >
        <Provider value={options}>
          <PreviewCtx.Provider
            value={{ previews, setPreviews, uploadedFiles, setUploadedFiles }}
          >
            <RelationsCtx.Provider
              value={{
                relationsCache,
                setRelationsCache,
              }}
            >
              <StorageCtx.Provider
                value={{
                  craftToSaltcorn,
                  layoutToNodes,
                }}
              >
                <div className="row" ref={ref} style={{ marginTop: "-5px" }}>
                  <div
                    className={`col-sm-auto left-builder-col ${
                      isLeftEnlarged
                        ? "builder-left-enlarged"
                        : "builder-left-shrunk"
                    }`}
                  >
                    <div className="componets-and-library-accordion toolbox-card">
                      <InitNewElement
                        nodekeys={nodekeys}
                        setSavingState={setSavingState}
                        savingState={savingState}
                      />
                      <Accordion>
                        <div className="card mt-1" accordiontitle={t("Components")}>
                          {{
                            show: <ToolboxShow expanded={isLeftEnlarged} />,
                            list: <ToolboxList expanded={isLeftEnlarged} />,
                            edit: <ToolboxEdit expanded={isLeftEnlarged} />,
                            page: <ToolboxPage expanded={isLeftEnlarged} />,
                            filter: <ToolboxFilter expanded={isLeftEnlarged} />,
                          }[mode] || <div>{t("Missing mode")}</div>}
                        </div>
                        <div accordiontitle={t("Library")}>
                          <Library expanded={isLeftEnlarged} />
                        </div>
                      </Accordion>
                    </div>
                    <div
                      className="card toolbox-card pe-0"
                      style={isLeftEnlarged ? { width: "13.4rem" } : {}}
                    >
                      <div className="card-header p-2 d-flex justify-content-between">
                        <div>{t("Layers")}</div>
                        <FontAwesomeIcon
                          icon={
                            isLeftEnlarged
                              ? faCaretSquareLeft
                              : faCaretSquareRight
                          }
                          className={
                            "float-end fa-lg builder-expand-toggle-left"
                          }
                          onClick={() => setIsLeftEnlarged(!isLeftEnlarged)}
                          title={isLeftEnlarged ? t("Shrink") : t("Enlarge")}
                        />
                      </div>
                      {showLayers && (
                        <div className="card-body p-0 builder-layers">
                          <Layers 
                            expandRootOnLoad={true}
                            renderLayer={CustomLayerComponent} 
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    id="builder-main-canvas"
                    style={{ height: canvasHeight }}
                    className={`col builder-mode-${options.mode} ${
                      options.mode !== "list" ? "emptymsg" : ""
                    }`}
                  >
                    <div>
                      <Frame>
                        {options.mode === "list" ? (
                          <Element canvas is={ListColumns}></Element>
                        ) : (
                          <Element canvas is={Column}></Element>
                        )}
                      </Frame>
                      {options.mode === "list" ? <AddColumnButton /> : null}
                    </div>
                  </div>
                  <div className="col-sm-auto builder-sidebar">
                    <div style={{ width: isEnlarged ? "28rem" : "16rem" }}>
                      <NextButton layout={layout} />
                      <HistoryPanel />
                      <FontAwesomeIcon
                        icon={faSave}
                        className={savingState.isSaving ? "d-inline" : "d-none"}
                      />
                      <FontAwesomeIcon
                        icon={faExclamationTriangle}
                        color="#ff0033"
                        className={savingState.error ? "d-inline" : "d-none"}
                      />
                      <FontAwesomeIcon
                        icon={
                          isEnlarged ? faCaretSquareRight : faCaretSquareLeft
                        }
                        className={
                          "float-end me-2 mt-1 fa-lg builder-expand-toggle-right"
                        }
                        onClick={() => setIsEnlarged(!isEnlarged)}
                        title={isEnlarged ? t("Shrink") : t("Enlarge")}
                      />
                      <div
                        className={` ${
                          savingState.error ? "d-block" : "d-none"
                        } my-2 fw-bold`}
                      >
                        {t("your work is not being saved")}
                      </div>
                      <SettingsPanel />
                    </div>
                  </div>
                </div>
              </StorageCtx.Provider>
            </RelationsCtx.Provider>
          </PreviewCtx.Provider>
        </Provider>
        <div className="d-none preview-scratchpad"></div>
      </Editor>
      <style>
        {options.icons
          .filter((icon) => icon.startsWith("unicode-"))
          .map(
            (icon) =>
              `i.${icon}:after {content: '${String.fromCharCode(
                parseInt(icon.substring(8, 12), 16)
              )}'}`
          )
          .join("\n")}
      </style>
    </ErrorBoundary>
  );
};

export default Builder;
