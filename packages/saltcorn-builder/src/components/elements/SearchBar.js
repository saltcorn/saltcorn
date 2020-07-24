import React, { Fragment } from "react";
import { useNode } from "@craftjs/core";

export const SearchBar = ({}) => {
  const {
    connectors: { connect, drag }
  } = useNode();
  return (
    <div class="input-group" ref={dom => connect(drag(dom))}>
      <input
        type="text"
        class="form-control bg-light"
        placeholder="Search..."
        disabled
      />
      <div class="input-group-append">
        <button
          class="btn btn-primary"
          disabled
          type="submit"
          id="button-search-submit"
        >
          <i class="fas fa-search"></i>
        </button>
      </div>
    </div>
  );
};
