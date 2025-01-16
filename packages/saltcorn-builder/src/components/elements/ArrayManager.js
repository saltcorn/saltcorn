/**
 * @category saltcorn-builder
 * @module components/elements/utils
 * @subcategory components / elements
 */
/* globals $, _sc_globalCsrf*/
import React, { Fragment, useState, useEffect } from "react";
import optionsCtx from "../context";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faInfoCircle,
  faQuestionCircle,
  faBold,
  faItalic,
  faFont,
  faPlus,
  faCommentSlash,
  faUnderline,
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faTerminal,
  faTrashAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useNode, Element, useEditor } from "@craftjs/core";
import FontIconPicker from "@fonticonpicker/react-fonticonpicker";
import Tippy from "@tippyjs/react";
import { RelationType } from "@saltcorn/common-code";
import Select from "react-select";
import { recursivelyCloneToElems } from "./Clone";
import { ConfigField } from "./utils";

export const DynamicFontAwesomeIcon = ({ icon, className }) => {
  if (!icon) return null;
  return <i className={`${icon} ${className || ""}`}></i>;
};

const ntimes = (n, f) => {
  var res = [];
  for (let index = 0; index < n; index++) {
    res.push(f(index));
  }
  return res;
};

export const ArrayManager = ({
  node,
  setProp,
  countProp,
  currentProp,
  managedArrays,
}) => {
  console.log("tab children", node.contents);
  console.log("tab node", node);
  const { actions, query, connectors } = useEditor((state, query) => {
    return {};
  });
  const qres = query.node(node.id);
  console.log("linkedNodes", qres.linkedNodes());
  const move = (delta) => {
    if (managedArrays.includes("contents")) {
      const curIx = node[currentProp];

      const linkedNodes = query.node(node.id).linkedNodes();
      actions.move(linkedNodes[curIx], node.id, curIx + delta);
    }
    setProp((prop) => {
      const curIx = prop[currentProp];
      if (curIx + delta < 0 || curIx + delta >= prop[countProp]) return;

      managedArrays.forEach((arrNm) => {
        if (arrNm !== "contents") {
          const tmp = prop[arrNm][curIx];
          prop[arrNm][curIx] = prop[arrNm][curIx + delta];
          prop[arrNm][curIx + delta] = tmp;
        }
      });
      prop[currentProp] = prop[currentProp] + delta;
    });
  };
  const add = () => {
    setProp((prop) => {
      prop[countProp] = node[countProp] + 1;
      prop[currentProp] = node[countProp];
    });
  };
  const deleteElem = () => {
    const linkedNodes = query.node(node.id).linkedNodes();
    console.log(
      "del node id",
      linkedNodes[node[currentProp]],
      "from",
      linkedNodes
    );
    const RmNode = query.node(linkedNodes[node[currentProp]]);
    console.log("found", RmNode, RmNode.isDeletable(), RmNode.isLinkedNode());

    const elem = recursivelyCloneToElems(query)(node.id)
    console.log("elem clone", elem);
    const ntree= query.parseReactElement(elem).toNodeTree()
    console.log("parsed", query.parseReactElement(elem));
    
    console.log("nodetree",ntree);
    
    

    return;

    actions.delete(linkedNodes[node[currentProp]]);
    setProp((prop) => {
      const rmIx = prop[currentProp];

      managedArrays.forEach((arrNm) => {
        if (arrNm !== "contents") prop[arrNm].splice(rmIx, 1);
      });
      prop[countProp] = node[countProp] - 1;
      prop[currentProp] = node[currentProp] - 1;
    });
  };
  //console.log("arrayman", { node });

  return (
    <Fragment>
      <ConfigField
        field={{
          name: currentProp,
          label: "Number of things",
          type: "btn_select",
          options: ntimes(node[countProp], (i) => ({
            value: i,
            title: `${i + 1}`,
            label: `${i + 1}`,
          })),
        }}
        node={node}
        setProp={setProp}
        props={node}
      ></ConfigField>
      <div className="btn-group w-100" role="group">
        <button
          title="Move left"
          type="button"
          style={{ width: "25%" }}
          className="btn btn-sm"
          onClick={() => move(-1)}
          disabled={node[currentProp] === 0}
        >
          <FontAwesomeIcon icon={faAngleDoubleLeft} />
        </button>
        <button
          title="Add"
          type="button"
          style={{ width: "25%" }}
          className="btn btn-sm"
          onClick={() => add()}
        >
          <FontAwesomeIcon icon={faPlus} />
        </button>
        <button
          title="Delete"
          type="button"
          style={{ width: "25%" }}
          className="btn btn-sm"
          onClick={() => deleteElem()}
        >
          <FontAwesomeIcon icon={faTrashAlt} />
        </button>
        <button
          title="Move right"
          type="button"
          disabled={node[currentProp] === node[countProp] - 1}
          style={{ width: "25%" }}
          className="btn btn-sm"
          onClick={() => move(1)}
        >
          <FontAwesomeIcon icon={faAngleDoubleRight} />
        </button>
      </div>
    </Fragment>
  );
};
