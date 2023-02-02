import Node from "./nodes/node";
import CytoscapeRaster from "./cy_raster";
import type { ExtractResult } from "./node_extract_utils";

const cyStyle = [
  {
    selector: "edge",
    style: {
      width: 3,
      "line-color": "#ccc",
      "target-arrow-color": "#000",
      "target-arrow-shape": "triangle",
      "arrow-scale": 1,
    },
  },
  {
    selector: "edge[type='new_target']",
    style: {
      "curve-style": "bezier",
    },
  },
  {
    selector: "edge[type='existing_target']",
    style: {
      "curve-style": "unbundled-bezier",
      "control-point-distance": -60,
    },
  },
  {
    selector: "node",
    style: {
      label: "data(label)",
      shape: "ellipse",
    },
  },
  {
    selector: "node[type='view']",
    style: {
      "background-color": "blue",
    },
  },
  {
    selector: "node[type='page']",
    style: {
      "background-color": "green",
    },
  },
  {
    selector: "node[type='table']",
    style: {
      "background-color": "gray",
    },
  },
  {
    selector: "node[type='trigger']",
    style: {
      "background-color": "yellow",
    },
  },
  {
    selector: "node[?isVirtual]",
    style: {
      opacity: 0.4,
    },
  },

];

/**
 * generates a cfg to re-init cytoscape.js on ajax requests
 * @param entryNodes roots for the graphs, 
                     if not set, roots will be used how the db delivers them
 * @returns cytoscape.js cfg object
 */
export function genereateCyCfg(extracted: ExtractResult): any {
  const raster = new CytoscapeRaster(extracted);
  return {
    elements: {
      nodes: raster.buildCyNodes(),
      edges: raster.buildCyEdges(),
    },
    style: cyStyle,
    layout: {
      name: "preset",
    },
  };
}

/**
 * generates code to initalise cytoscape.js when the page loads the first time
 * @param entryNodes roots for the graphs, 
                     if not set, roots will be used how the db delivers them
 * @returns cytoscape.js code as string
 */
export function generateCyCode(extracted: ExtractResult): string {
  const raster = new CytoscapeRaster(extracted);
  const cyNodes = raster.buildCyNodes();
  const cyEdges = raster.buildCyEdges();
  return `
  var cy = window.cy = cytoscape({
    maxZoom: 2,
    wheelSensitivity: 0.3,
    container: document.getElementById('cy'),
    elements: {
      nodes: ${JSON.stringify(cyNodes)},
      edges: ${JSON.stringify(cyEdges)},
    },
    style: ${JSON.stringify(cyStyle)},
    layout: {
      name: "preset"
    },
  });
  initMouseOver();
  `;
}
