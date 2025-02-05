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
import { Empty } from "./Empty";
import { Column } from "./Column";
import storageCtx from "../storage_context";

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
  manageContents,
  initialAddProps,
}) => {
  const { actions, query, connectors } = useEditor((state, query) => {
    return {};
  });
  const { craftToSaltcorn, layoutToNodes } = React.useContext(storageCtx);
  const options = React.useContext(optionsCtx);

  const fullNode = query.node(node.id).get();
  const parentId = fullNode.data.parent;
  const siblings = query.node(parentId).childNodes();
  const sibIx = siblings.findIndex((sib) => sib === node.id);

  const deleteElem = () => {
    if (manageContents) {
      const rmIx = node[currentProp];
      const { layout } = craftToSaltcorn(
        JSON.parse(query.serialize()),
        node.id,
        options
      );
      layout.contents.splice(rmIx, 1);

      managedArrays.forEach((arrNm) => {
        layout[arrNm].splice(rmIx, 1);
      });
      layout[countProp] = node[countProp] - 1;
      layout[currentProp] = node[currentProp] - 1;
      actions.delete(node.id);
      layoutToNodes(layout, query, actions, parentId, options, sibIx);
    } else {
      setProp((prop) => {
        const rmIx = prop[currentProp];

        managedArrays.forEach((arrNm) => {
          if (arrNm.includes(".")) {
            const vars = arrNm.split(".");
            let arr = prop;
            for (const tvar of vars) arr = arr[tvar];
            if (arr) arr.splice(rmIx, 1);
          } else if (prop[arrNm]) prop[arrNm].splice(rmIx, 1);
        });
        prop[countProp] = node[countProp] - 1;
        prop[currentProp] = node[currentProp] - 1;
      });
    }
  };

  const move = (delta) => {
    const swapElements = (arr, i, j) => {
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    };
    if (manageContents) {
      const curIx = node[currentProp];

      const { layout } = craftToSaltcorn(
        JSON.parse(query.serialize()),
        node.id,
        options
      );

      swapElements(layout.contents, curIx, curIx + delta);

      managedArrays.forEach((arrNm) => {
        if (arrNm.includes(".")) {
          let arr = layout;
          for (const tvar of arrNm.split(".")) arr = arr[tvar];
          if (arr) swapElements(arr, curIx, curIx + delta);
        } else if (layout[arrNm])
          swapElements(layout[arrNm], curIx, curIx + delta);
      });
      layout[currentProp] = node[currentProp] + delta;
      actions.delete(node.id);
      layoutToNodes(layout, query, actions, parentId, options, sibIx);
    } else
      setProp((prop) => {
        const curIx = prop[currentProp];
        if (curIx + delta < 0 || curIx + delta >= prop[countProp]) return;

        managedArrays.forEach((arrNm) => {
          if (arrNm.includes(".")) {
            let arr = prop;
            for (const tvar of arrNm.split(".")) arr = arr[tvar];
            if (arr) swapElements(arr, curIx, curIx + delta);
          } else if (prop[arrNm])
            swapElements(prop[arrNm], curIx, curIx + delta);
        });
        prop[currentProp] = prop[currentProp] + delta;
      });
  };
  const add = () => {
    if (manageContents) {
      const { layout } = craftToSaltcorn(
        JSON.parse(query.serialize()),
        node.id,
        options
      );

      layout.contents.push(null);
      managedArrays.forEach((arrNm) => {
        if (initialAddProps?.[arrNm])
          layout[arrNm][node[countProp]] = initialAddProps?.[arrNm];
      });
      layout[currentProp] = +node[countProp];
      layout[countProp] = +node[countProp] + 1;

      actions.delete(node.id);
      layoutToNodes(layout, query, actions, parentId, options, sibIx);
    } else
      setProp((prop) => {
        prop[countProp] = node[countProp] + 1;
        prop[currentProp] = node[countProp];
        managedArrays.forEach((arrNm) => {
          if (initialAddProps?.[arrNm])
            if (arrNm.includes(".")) {
              let arr = prop;
              for (const tvar of arrNm.split(".")) arr = arr[tvar];
              if (arr) arr[node[countProp]] = initialAddProps?.[arrNm];
            } else if (prop[arrNm])
              prop[arrNm][node[countProp]] = initialAddProps?.[arrNm];
        });
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
