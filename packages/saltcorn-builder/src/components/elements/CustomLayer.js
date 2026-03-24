import React, { memo, useState, useEffect } from "react";
import { useLayer } from "@craftjs/layers";
import { useEditor } from "@craftjs/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faLevelUpAlt, faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";

const hiddenColumnParents = new Set(["Card", "Container", "Tabs", "Table"]);

const CustomLayerComponent = memo(({ children }) => {
  const [isMouseOver, setIsMouseOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const {
    id,
    depth,
    expanded,
    actions: { toggleLayer, setExpandedState },
    connectors: { layer, drag, layerHeader },
  } = useLayer((layer) => {
      return {
        expanded: layer?.expanded,
      };
  });

  const { displayName, hasNodes, isHiddenColumn, selected, parentId, childIndex, siblingCount, canMoveOut, connectors: editorConnectors, actions: editorActions, query } = useEditor((state) => {
      const node = state.nodes[id];
      const data = node?.data;

      let name = data?.custom?.displayName || data?.props?.custom?.displayName || data?.displayName || data?.name || id;
      if (name === "ROOT" || name === "Canvas") {
          name = data?.name || name;
      }

      // Rename linked Columns for Tabs and Table
      if (name === "Column" && data?.parent) {
          const parentNode = state.nodes[data.parent];
          const parentName = parentNode?.data?.displayName || parentNode?.data?.name;
          const parentLinked = parentNode?.data?.linkedNodes;
          if (parentLinked) {
              const key = Object.keys(parentLinked).find(k => parentLinked[k] === id);
              if (key) {
                  if (parentName === "Tabs") {
                      const index = parseInt(key.replace("Tab", ""), 10);
                      if (!isNaN(index)) {
                          name = `Tab ${index + 1}`;
                      }
                  } else if (parentName === "Table") {
                      // key is "cell_0_0", "cell_1_2", etc.
                      const match = key.match(/^cell_(\d+)_(\d+)$/);
                      if (match) {
                          name = `R${parseInt(match[1], 10) + 1}C${parseInt(match[2], 10) + 1}`;
                      }
                  }
              }
          }
      }

      const nodes = data?.nodes;
      const linkedNodes = data?.linkedNodes;
      const hasChildren = (nodes && nodes.length > 0) || (linkedNodes && Object.keys(linkedNodes).length > 0);

      // Check if this Column is a linked node of a Card/Container/Tabs/Table
      let shouldHide = false;
      if ((data?.displayName === "Column" || data?.name === "Column") && data?.parent) {
          const parentNode = state.nodes[data.parent];
          const parentName = parentNode?.data?.displayName || parentNode?.data?.name;
          if (hiddenColumnParents.has(parentName)) {
              const parentLinked = parentNode?.data?.linkedNodes;
              if (parentLinked && Object.values(parentLinked).includes(id)) {
                  shouldHide = true;
              }
          }
      }

      const isSelected = state.events?.selected?.has?.(id) || (state.events?.selected === id);

      const parent = data?.parent;
      let childIx = -1;
      let sibCount = 0;
      if (parent && state.nodes[parent]) {
          const parentNodes = state.nodes[parent]?.data?.nodes || [];
          childIx = parentNodes.indexOf(id);
          sibCount = parentNodes.length;
      }

      let canMoveOut = false;
      if (parent && state.nodes[parent]) {
          const grandparent = state.nodes[parent]?.data?.parent;
          if (grandparent && grandparent !== "ROOT" && state.nodes[grandparent]) {
              const greatGrandparent = state.nodes[grandparent]?.data?.parent;
              if (greatGrandparent && state.nodes[greatGrandparent]) {
                  canMoveOut = true;
              }
          }
      }

      return {
          displayName: name,
          hasNodes: hasChildren,
          isHiddenColumn: shouldHide,
          selected: isSelected,
          parentId: parent,
          childIndex: childIx,
          siblingCount: sibCount,
          canMoveOut,
      };
  });

  const isRoot = id === "ROOT";

  // Auto-expand hidden linked-node Columns so their children are always
  // visible through the transparent wrapper. Uses setExpandedState(true)
  // instead of toggleLayer() — it's idempotent (no-op when already true),
  // so it won't conflict with craft.js internals or cause toggle loops.
  useEffect(() => {
    if ((isHiddenColumn || isRoot) && !expanded) {
      setExpandedState(true);
    }
  }, [isHiddenColumn, isRoot, expanded, setExpandedState]);

  if (isHiddenColumn || isRoot) {
    return (
      <div
        ref={(dom) => { layer(dom); if (dom) editorConnectors.drop(dom, id); }}
        style={{ marginLeft: "-14px" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={(dom) => { layer(dom); if (dom) editorConnectors.drop(dom, id); }}>
        <div
          ref={(dom) => { drag(dom); layerHeader(dom); }}
          className={`builder-layer-node ${isMouseOver ? "hovered" : ""} ${selected ? "selected" : ""}`}
          style={{
            paddingLeft: `${depth * 14 + 10}px`,
            overflow: "hidden",
          }}
          onMouseEnter={() => setIsMouseOver(true)}
          onMouseLeave={() => setIsMouseOver(false)}
        >
          {isEditing ? (
            <input
              className="layer-name-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                const trimmed = editValue.trim();
                editorActions.setCustom(id, (custom) => {
                  if (trimmed && trimmed !== (custom.displayName || "")) {
                    custom.displayName = trimmed;
                  } else if (!trimmed) {
                    delete custom.displayName;
                  }
                });
                setIsEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
                if (e.key === "Escape") { setIsEditing(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              autoFocus
              style={{ flexGrow: 1, minWidth: 0, width: 0, fontSize: 13, padding: "0 2px", border: "1px solid #2680eb", outline: "none", background: "transparent", color: "inherit" }}
            />
          ) : (
            <span
              className="layer-name"
              style={{ flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditValue(displayName);
                setIsEditing(true);
              }}
            >
              {displayName}
            </span>
          )}

          {isMouseOver && !isEditing && parentId && childIndex >= 0 && (
            <span className="layer-move-buttons" style={{ display: "inline-flex", gap: 2, marginLeft: 4, flexShrink: 0 }}>
              {childIndex > 0 && (
                <span
                  title="Move up"
                  style={{ cursor: "pointer", padding: "0 2px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    editorActions.move(id, parentId, childIndex - 1);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <FontAwesomeIcon icon={faArrowUp} fontSize={10} />
                </span>
              )}
              {childIndex >= 0 && childIndex < siblingCount - 1 && (
                <span
                  title="Move down"
                  style={{ cursor: "pointer", padding: "0 2px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    editorActions.move(id, parentId, childIndex + 2);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <FontAwesomeIcon icon={faArrowDown} fontSize={10} />
                </span>
              )}
              {canMoveOut && (
                <span
                  title="Move out of container"
                  style={{ cursor: "pointer", padding: "0 2px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      const parentData = query.node(parentId).get();
                      const grandparentId = parentData.data.parent;
                      const grandparentData = query.node(grandparentId).get();
                      const greatGrandparentId = grandparentData.data.parent;
                      const greatGrandparentChildren = query.node(greatGrandparentId).childNodes();
                      const grandparentIndex = greatGrandparentChildren.indexOf(grandparentId);
                      editorActions.move(id, greatGrandparentId, grandparentIndex >= 0 ? grandparentIndex + 1 : greatGrandparentChildren.length);
                    } catch (err) {
                      console.warn("Move out failed:", err);
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <FontAwesomeIcon icon={faLevelUpAlt} fontSize={10} />
                </span>
              )}
            </span>
          )}

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

export default CustomLayerComponent