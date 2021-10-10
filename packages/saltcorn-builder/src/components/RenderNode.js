import { useNode, useEditor } from "@craftjs/core";
//import { ROOT_NODE } from "@craftjs/utils";
import React, { useEffect, useRef, useCallback, Fragment } from "react";
import ReactDOM from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faUndo,
  faRedo,
  faTrashAlt,
  faArrowUp,
} from "@fortawesome/free-solid-svg-icons";
/* 
Contains code copied from craft.js landing page example
Copyright (c) 2020 Previnash Wong Sze Chuan
*/

export const RenderNode = ({ render }) => {
  const { id } = useNode();
  const { actions, query, isActive } = useEditor((state) => ({
    isActive: state.nodes[id].events.selected,
  }));

  const {
    isHover,
    dom,
    name,
    moveable,
    deletable,
    connectors: { drag },
    parent,
  } = useNode((node) => ({
    isHover: node.events.hovered,
    dom: node.dom,
    name: node.data.custom.displayName || node.data.displayName,
    moveable: query.node(node.id).isDraggable(),
    deletable: query.node(node.id).isDeletable(),
    parent: node.data.parent,
    props: node.data.props,
  }));

  const currentRef = useRef();

  const getPos = useCallback((dom) => {
    const { top, left, bottom, height, width, right } = dom
      ? dom.getBoundingClientRect()
      : { top: 0, left: 0, bottom: 0, right: 0, height: 0, width: 0 };
    return {
      top: `${top > 0 ? top : bottom}px`,
      left: `${left}px`,
      topn: top,
      leftn: left,
      height,
      width,
      right,
      bottom,
    };
  }, []);

  const scroll = useCallback(() => {
    const { current: currentDOM } = currentRef;
    if (!currentDOM) return;
    const { top, left } = getPos(dom);
    currentDOM.style.top = top;
    currentDOM.style.left = left;
  }, [dom, getPos]);

  useEffect(() => {
    document
      .getElementById("builder-main-canvas")
      .addEventListener("scroll", scroll);
    document.addEventListener("scroll", scroll);

    return () => {
      document
        .getElementById("builder-main-canvas")
        .removeEventListener("scroll", scroll);
      document.removeEventListener("scroll", scroll);
    };
  }, [scroll]);
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
    } = query.node(id).get();
    const elem = recursivelyCloneToElems(id);
    actions.addNodeTree(
      query.parseReactElement(elem).toNodeTree(),
      parent || "ROOT"
    );
  };
  return (
    <>
      {(isActive || isHover) && name !== "Column"
        ? ReactDOM.createPortal(
            <div
              ref={currentRef}
              className={`selected-indicator ${
                isActive ? "activeind" : "hoverind"
              } px-1 text-white`}
              style={{
                left: getPos(dom).left,
                top: getPos(dom).top,
                zIndex: 9999,
              }}
            >
              <div className="dispname mr-3">{name}</div>
              {isActive && parent && parent !== "ROOT" ? (
                <FontAwesomeIcon
                  icon={faArrowUp}
                  className="mr-2"
                  onClick={() => {
                    actions.selectNode(parent);
                  }}
                />
              ) : null}
              {deletable && isActive
                ? [
                    <FontAwesomeIcon
                      key={1}
                      icon={faCopy}
                      onClick={duplicate}
                      className="mr-2"
                    />,
                    <FontAwesomeIcon
                      key={2}
                      icon={faTrashAlt}
                      className="mr-2"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        actions.delete(id);
                        setTimeout(() => actions.selectNode(parent), 0);
                      }}
                    />,
                  ]
                : null}
            </div>,
            document.querySelector("#builder-main-canvas")
          )
        : null}
      {render}
    </>
  );
};
/*
   {moveable ? (
                <Btn className="mr-2 cursor-move" ref={drag}>
                  <Move />
                </Btn>
              ) : null}
              {id !== ROOT_NODE && (
                <Btn
                  className="mr-2 cursor-pointer"
                  onClick={() => {
                    actions.selectNode(parent);
                  }}
                >
                  <ArrowUp />
                </Btn>
              )}
              {deletable ? (
                <Btn
                  className="cursor-pointer"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    actions.delete(id);
                  }}
                >
                  <Delete />
                </Btn>
              ) : null}
*/
