/**
 * @category saltcorn-builder
 * @module saltcorn-builder/index
 */

import React from "react";
import Builder from "./components/Builder";
import ReactDOM from "react-dom";

/**
 * 
 * @param {object} id 
 * @param {object} options 
 * @param {object} layout 
 * @param {string} mode 
 */
function renderBuilder(id, options, layout, mode) {
  ReactDOM.render(
    <Builder
      options={JSON.parse(decodeURIComponent(options))}
      layout={JSON.parse(decodeURIComponent(layout))}
      mode={mode}
    />,
    document.getElementById(id)
  );
}

export { renderBuilder };
