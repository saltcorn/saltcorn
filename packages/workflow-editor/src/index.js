/* global document */
const React = require("react");
const ReactDOM = require("react-dom");
const WorkflowEditor =
  require("./WorkflowEditor").default || require("./WorkflowEditor");
let createRoot;
try {
  ({ createRoot } = require("react-dom/client"));
} catch (e) {
  createRoot = null;
}

function renderWorkflowEditor(id, encoded) {
  const mount = document.getElementById(id);
  if (!mount) return;
  let data;
  try {
    data = JSON.parse(decodeURIComponent(encoded));
  } catch (e) {
    console.error("Unable to parse workflow data", e);
    return;
  }
  if (createRoot) {
    const root = createRoot(mount);
    root.render(React.createElement(WorkflowEditor, { data }));
    return;
  }
  ReactDOM.render(React.createElement(WorkflowEditor, { data }), mount);
}

module.exports = { renderWorkflowEditor };
