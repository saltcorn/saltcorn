import React from "react";
import Builder from "./components/Builder";
import ReactDOM from "react-dom";

function renderBuilder(id) {
  const wrapper = document.getElementById(id);
  wrapper ? ReactDOM.render(<Builder />, wrapper) : false;
}

export { renderBuilder };
