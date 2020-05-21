import React from "react";
import Builder from "./components/Builder";
import ReactDOM from "react-dom";

function renderBuilder(id, options, layout) {
  ReactDOM.render(
    <Builder options={options} layout={layout} />,
    document.getElementById(id)
  );
}

export { renderBuilder };
