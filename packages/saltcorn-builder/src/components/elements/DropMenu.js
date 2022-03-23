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
import {
  SettingsRow,
  BlockSetting,
  ButtonOrLinkSettingsRows,
  DynamicFontAwesomeIcon,
} from "./utils";

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
const DropMenu = ({
  children,
  action_style,
  action_size,
  action_icon,
  action_bgcol,
  action_bordercol,
  action_textcol,
  block,
  label,
}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const [showDropdown, setDropdown] = useState(false);
  //const [dropWidth, setDropWidth] = useState(200);
  return (
    <div
      className={`${selected ? "selected-node" : ""} ${block ? "d-block" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      <button
        className={`btn ${action_style || "btn-primary"} ${action_size || ""} `}
        style={
          action_style === "btn-custom-color"
            ? {
                backgroundColor: action_bgcol || "#000000",
                borderColor: action_bordercol || "#000000",
                color: action_textcol || "#000000",
              }
            : {}
        }
      >
        <DynamicFontAwesomeIcon icon={action_icon} className="me-1" />

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
        <div className="canvas d-flex flex-column">{children}</div>
      </div>
    </div>
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
    block: node.data.props.block,
    action_style: node.data.props.action_style,
    action_size: node.data.props.action_size,
    action_icon: node.data.props.action_icon,
    action_bgcol: node.data.props.action_bgcol,
    action_bordercol: node.data.props.action_bordercol,
    action_textcol: node.data.props.action_textcol,
  }));
  const {
    actions: { setProp },
    label,
    block,
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
        <ButtonOrLinkSettingsRows
          setProp={setProp}
          keyPrefix="action_"
          values={node}
        />
        <tr>
          <td colSpan="2">
            <BlockSetting block={block} setProp={setProp} />
          </td>
        </tr>
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
    label: "Menu",
    block: false,
  },
  related: {
    settings: DropMenuSettings,
    segment_type: "dropdown_menu",
    hasContents: true,
    fields: [
      "label",
      "block",
      "action_style",
      "action_size",
      "action_icon",
      "action_bgcol",
      "action_bordercol",
      "action_textcol",
    ],
  },
};
