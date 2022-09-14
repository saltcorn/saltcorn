import Node from "./node";
import CytoscapeRaster from "./cy_raster";

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
];

/**
 * generates code to initalise cytoscape.js and draw the application object tree
 * @param entryNodes roots for the graphs, 
                     if not set roots, will be used how the db delivers them
 * @returns cytoscape.js code as string
 */
export function generateCyCode(entryNodes: Array<Node>): string {
  const raster = new CytoscapeRaster(entryNodes);
  const cyNodes = raster.buildCyNodes();
  const cyEdges = raster.buildCyEdges();
  return `
  var cy = window.cy = cytoscape({
    container: document.getElementById('cy'),
    elements: {
      nodes: ${JSON.stringify(cyNodes)},
      edges: ${JSON.stringify(cyEdges)},
    },
    style: ${JSON.stringify(cyStyle)},
    layout: {
      name: "preset"
    },
  });`;
}
