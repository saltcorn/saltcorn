import React from "react";
import Builder from "./components/Builder";
import ReactDOM from "react-dom";

function renderBuilder(id, options, layout, mode) {
  ReactDOM.render(
    <Builder options={options} layout={layout} mode={mode} />,
    document.getElementById(id)
  );
}

export { renderBuilder };
