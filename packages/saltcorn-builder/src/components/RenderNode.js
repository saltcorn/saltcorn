import { useNode, useEditor } from "@craftjs/core";
//import { ROOT_NODE } from "@craftjs/utils";
import React, { useEffect, useRef, useCallback, Fragment } from "react";
import ReactDOM from "react-dom";

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

  useEffect(() => {
    if (dom) {
      if (isActive || isHover) dom.classList.add("component-selected");
      else dom.classList.remove("component-selected");
    }
  }, [dom, isActive, isHover]);

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

  return (
    <>
      {isActive
        ? ReactDOM.createPortal(
            <Fragment>
              <div
                ref={currentRef}
                className="selected-indicator px-2 py-2 text-white bg-primary"
                style={{
                  left: getPos(dom).left,
                  top: getPos(dom).top,
                  zIndex: 9999,
                }}
              >
                <h6 className="dispname mr-4">{name}</h6>
              </div>
              <div
                className="selected-node-border"
                style={{
                  left: getPos(dom).left,
                  top: getPos(dom).top,
                  height: getPos(dom).height,
                  width: 0,
                }}
              ></div>
              <div
                className="selected-node-border"
                style={{
                  left: getPos(dom).left,
                  top: getPos(dom).top,
                  height: 0,
                  width: getPos(dom).width,
                }}
              ></div>
              <div
                className="selected-node-border"
                style={{
                  left: getPos(dom).left + getPos(dom).width,
                  top: getPos(dom).top,
                  height: getPos(dom).height,
                  width: 0,
                }}
              ></div>
              <div
                className="selected-node-border"
                style={{
                  left: getPos(dom).left,
                  top: getPos(dom).top + getPos(dom).height,
                  height: 0,
                  width: getPos(dom).width,
                }}
              ></div>
            </Fragment>,
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
