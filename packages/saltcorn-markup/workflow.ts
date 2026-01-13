/**
 * @category saltcorn-markup
 * @module workflow
 */

import tags = require("./tags");
const { div, script, style } = tags;

const encode = (x: any): string => encodeURIComponent(JSON.stringify(x));

/**
 * Render the workflow editor shell
 * @param workflowData
 * @param version_tag
 * @returns {string}
 */
const renderWorkflow = (workflowData: any, version_tag?: string): string =>
  div(
    { class: "workflow-editor-wrapper" },
    style(`
      .workflow-editor-wrapper { min-height: 640px; }
      #saltcorn-workflow-editor { height: 720px; }
    `),
    script({
      src: version_tag
        ? `/static_assets/${version_tag}/workflow_bundle.js`
        : "/workflow_bundle.js",
    }),
    div({ id: "saltcorn-workflow-editor" }),
    script(
      `workflow.renderWorkflowEditor("saltcorn-workflow-editor", "${encode(workflowData)}");`
    )
  );

export = renderWorkflow;
