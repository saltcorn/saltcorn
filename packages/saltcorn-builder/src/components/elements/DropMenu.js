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
const DropMenu = ({ children, action_style, action_size, block }) => {
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
        <FontAwesomeIcon
          icon={faCaretDown}
          onClick={() => setDropdown(!showDropdown)}
        />
      </button>
      <div
        className={`dropdown-menu DropMenu-dropdown ${
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
  const {
    actions: { setProp },
    has_dropdown,
    show_badges,
  } = useNode((node) => ({
    has_dropdown: node.data.props.has_dropdown,
    show_badges: node.data.props.show_badges,
  }));

  return (
    <div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={has_dropdown}
          onChange={(e) =>
            setProp((prop) => (prop.has_dropdown = e.target.checked))
          }
        />
        <label className="form-check-label">Has Dropdown</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={show_badges}
          onChange={(e) =>
            setProp((prop) => (prop.show_badges = e.target.checked))
          }
        />
        <label className="form-check-label">Show current state badges</label>
      </div>
    </div>
  );
};

/**
 * @type {object}
 */
DropMenu.craft = {
  displayName: "DropMenu",
  props: {
    has_dropdown: false,
    show_badges: false,
  },
  related: {
    settings: DropMenuSettings,
    segment_type: "dropdown_menu",
    hasContents: true,
    fields: ["has_dropdown", "show_badges"],
  },
};
