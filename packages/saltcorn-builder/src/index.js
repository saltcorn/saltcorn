import React from "react";
import Builder from "./components/Builder";
import ReactDOM from "react-dom";

function renderBuilder(id, options, craft_nodes) {
  ReactDOM.render(
    <Builder options={options} craft_nodes={JSON.stringify(craft_nodes)} />,
    document.getElementById(id)
  );
}

export { renderBuilder };
