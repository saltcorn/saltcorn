/**
 * @category saltcorn-builder
 * @module components/elements/SearchBar
 * @subcategory components / elements
 */

import React, { Fragment, useState } from "react";
import { Element, useNode } from "@craftjs/core";
import { Column } from "./Column";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/free-solid-svg-icons";
import { setAPropGen } from "./utils";

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
const SearchBar = ({ has_dropdown, children, show_badges }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const [showDropdown, setDropdown] = useState(false);
  const [dropWidth, setDropWidth] = useState(200);
  return (
    <div
      className={`input-group  ${selected ? "selected-node" : ""}`}
      ref={(dom) => {
        if (dom && dom.getBoundingClientRect) {
          //console.log(dom.getBoundingClientRect());
          const elwidth = dom.getBoundingClientRect().width;
          if (elwidth !== dropWidth) setDropWidth(elwidth);
        }
        connect(drag(dom));
      }}
    >
      <button className="btn btn-outline-secondary" disabled>
        <i className="fas fa-search"></i>
      </button>

      <input
        type="text"
        className="form-control bg-light"
        placeholder="Search..."
        readOnly={true}
      />

      {show_badges && (
        <div className="input-group-text">
          <span className="badge bg-primary">X:Y</span>
        </div>
      )}
      {has_dropdown && (
        <Fragment>
          <button
            className="btn btn-outline-secondary"
            onClick={() => setDropdown(!showDropdown)}
          >
            <FontAwesomeIcon icon={faCaretDown} />
          </button>
          <div
            className={`dropdown-menu searchbar-dropdown ${
              showDropdown ? "show" : ""
            }`}
            style={{ width: dropWidth, left: 0 }}
          >
            <div className="canvas">{children}</div>
          </div>
        </Fragment>
      )}
    </div>
  );
};

export /**
 * @returns {div}
 * @namespace
 * @category saltcorn-builder
 * @subcategory components
 */
const SearchBarSettings = () => {
  const {
    actions: { setProp },
    has_dropdown,
    show_badges,
    autofocus,
  } = useNode((node) => ({
    has_dropdown: node.data.props.has_dropdown,
    show_badges: node.data.props.show_badges,
    autofocus: node.data.props.autofocus,
  }));
  const setAProp = setAPropGen(setProp);

  return (
    <div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={has_dropdown}
          onChange={setAProp("has_dropdown", { checked: true })}
        />
        <label className="form-check-label">Has Dropdown</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={show_badges}
          onChange={setAProp("show_badges", { checked: true })}
        />
        <label className="form-check-label">Show current state badges</label>
      </div>
      <div className="form-check">
        <input
          className="form-check-input"
          name="block"
          type="checkbox"
          checked={autofocus}
          onChange={setAProp("autofocus", { checked: true })}
        />
        <label className="form-check-label">Autofocus</label>
      </div>
    </div>
  );
};

/**
 * @type {object}
 */
SearchBar.craft = {
  displayName: "SearchBar",
  props: {
    has_dropdown: false,
    show_badges: false,
    autofocus: false,
  },
  related: {
    settings: SearchBarSettings,
    segment_type: "search_bar",
    hasContents: true,
    fields: ["has_dropdown", "show_badges", "autofocus"],
  },
};
