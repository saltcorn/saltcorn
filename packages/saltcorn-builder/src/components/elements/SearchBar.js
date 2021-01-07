import React, { Fragment, useState } from "react";
import { Element, useNode } from "@craftjs/core";
import { Column } from "./Column";

export const SearchBar = ({ has_dropdown, contents, show_badges }) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  const [showDropdown, setDropdown] = useState(false);
  const [dropWidth, setDropWidth] = useState(200);
  return (
    <Fragment>
      <div
        className={`input-group  ${selected ? "selected-node" : ""}`}
        ref={(dom) => {
          if (dom && dom.getBoundingClientRect) {
            const elwidth = dom.getBoundingClientRect().width;
            if (elwidth !== dropWidth) setDropWidth(elwidth);
          }
          connect(drag(dom));
        }}
      >
        <input
          type="text"
          className="form-control bg-light"
          placeholder="Search..."
          disabled
        />

        <div className="input-group-append">
          {show_badges && (
            <div className="input-group-text">
              <span class="badge badge-primary">X:Y</span>
            </div>
          )}
          {has_dropdown && (
            <button
              className="btn btn-primary"
              onClick={() => setDropdown(!showDropdown)}
            >
              {showDropdown ? "⏷" : "⏴"}
            </button>
          )}
          <button
            className="btn btn-primary"
            disabled
            type="submit"
            id="button-search-submit"
          >
            <i className="fas fa-search"></i>
          </button>
        </div>
      </div>
      <div
        className={`dropdown-menu searchbar-dropdown ${
          showDropdown ? "show" : ""
        }`}
        style={{ width: dropWidth }}
      >
        <Element canvas id={`search_drop`} is={Column}>
          {contents}
        </Element>
      </div>
    </Fragment>
  );
};
export const SearchBarSettings = () => {
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
SearchBar.craft = {
  displayName: "SearchBar",
  props: {
    has_dropdown: false,
    contents: [],
  },
  related: {
    settings: SearchBarSettings,
  },
};
