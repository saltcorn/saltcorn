import { useNode, useEditor } from "@craftjs/core";
//import { ROOT_NODE } from "@craftjs/utils";
import React, { useEffect, useRef, useCallback } from "react";
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
    const { top, left, bottom } = dom
      ? dom.getBoundingClientRect()
      : { top: 0, left: 0, bottom: 0 };
    return {
      top: `${top > 0 ? top : bottom}px`,
      left: `${left}px`,
    };
  }, []);

  const scroll = useCallback(() => {
    const { current: currentDOM } = currentRef;
    console.log(`scroll`);
    if (!currentDOM) return;
    const { top, left } = getPos(dom);
    currentDOM.style.top = top;
    currentDOM.style.left = left;
  }, [dom, getPos]);

  useEffect(() => {
    document
      .querySelector("#builder-main-canvas")
      .addEventListener("scroll", scroll);
    document.body.addEventListener("scroll", scroll);

    return () => {
      document
        .querySelector("#builder-main-canvas")
        .removeEventListener("scroll", scroll);
      document.body.removeEventListener("scroll", scroll);
    };
  }, [scroll]);

  return (
    <>
      {isHover || isActive
        ? ReactDOM.createPortal(
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
