/**
 * @category saltcorn-builder
 * @module components/elements/DropMenu
 * @subcategory components / elements
 */

import React, { Fragment, useState } from "react";
import { Element, useNode } from "@craftjs/core";
import { Column } from "./Column";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/free-solid-svg-icons";
import { SettingsRow } from "./utils";

export /**
 * @param {object} props
 * @param {boolean} props.has_dropdown
 * @param {string} props.children
 * @param {boolean} props.show_badges
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const DropMenu = ({ children, action_style, action_size, block, label }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const [showDropdown, setDropdown] = useState(false);
  //const [dropWidth, setDropWidth] = useState(200);
  return (
    <Fragment>
      <button
        className={`btn ${action_style || "btn-primary"} ${action_size || ""} ${
          selected ? "selected-node" : ""
        } ${block ? "d-block" : ""}`}
        ref={(dom) => connect(drag(dom))}
      >
        {label}
        <FontAwesomeIcon
          icon={faCaretDown}
          className="ms-1"
          onClick={() => setDropdown(!showDropdown)}
        />
      </button>
      <div
        className={`dropdown-menu dropmenu-dropdown ${
          showDropdown ? "show" : ""
        }`}
      >
        <div className="canvas">{children}</div>
      </div>
    </Fragment>
  );
};

export /**
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const DropMenuSettings = () => {
  const node = useNode((node) => ({
    label: node.data.props.label,
    show_badges: node.data.props.show_badges,
  }));
  const {
    actions: { setProp },
    label,
    show_badges,
  } = node;
  return (
    <table className="w-100">
      <tbody>
        <SettingsRow
          field={{
            label: "Label",
            name: "label",
            type: "String",
          }}
          node={node}
          setProp={setProp}
        />
      </tbody>
    </table>
  );
};

/**
 * @type {object}
 */
DropMenu.craft = {
  displayName: "DropMenu",
  props: {
    label: "",
    show_badges: false,
  },
  related: {
    settings: DropMenuSettings,
    segment_type: "dropdown_menu",
    hasContents: true,
    fields: ["label", "show_badges"],
  },
};
