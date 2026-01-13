import React from "react";
import { createRoot } from "react-dom/client";
import ReactDOM from "react-dom";
import WorkflowEditor from "./WorkflowEditor";

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
    root.render(<WorkflowEditor data={data} />);
    return;
  }
  ReactDOM.render(<WorkflowEditor data={data} />, mount);
}

export { renderWorkflowEditor };
