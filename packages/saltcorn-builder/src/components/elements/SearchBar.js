import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";

export const SearchBar = ({}) => {
  const {
    selected,
    connectors: { connect, drag },
  } = useNode((node) => ({ selected: node.events.selected }));
  return (
    <div
      className={`input-group  ${selected ? "selected-node" : ""}`}
      ref={(dom) => connect(drag(dom))}
    >
      <input
        type="text"
        className="form-control bg-light"
        placeholder="Search..."
        disabled
      />
      <div className="input-group-append">
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
  );
};

SearchBar.craft = {
  displayName: "SearchBar",
};
