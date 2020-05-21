import React from "react";
import Builder from "./components/Builder";
import ReactDOM from "react-dom";

function renderBuilder(id, options) {
  ReactDOM.render(<Builder options={options} />, document.getElementById(id));
}

export { renderBuilder };
