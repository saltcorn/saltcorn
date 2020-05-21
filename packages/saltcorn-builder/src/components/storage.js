export const craftToSaltcorn = nodes => {
  var columns = [];
  const go = node => {
    if (node.isCanvas) {
      if (node.nodes.length == 0) return;
      else if (node.nodes.length == 1) return go(nodes[node.nodes[0]]);
      else return { above: node.nodes.map(nm => go(nodes[nm])) };
    }
    if (node.displayName === "Text") {
      return { type: "blank", contents: node.props.text };
    }
    if (node.displayName === "TwoSplit") {
      return {
        besides: [
          go(nodes[node._childCanvas.Left]),
          go(nodes[node._childCanvas.Right])
        ]
      };
    }
    if (node.displayName === "Field") {
      columns.push({
        type: "Field",
        field_name: node.props.name,
        fieldview: node.props.fieldview
      });
      return {
        type: "field",
        field_name: node.props.name,
        fieldview: node.props.fieldview
      };
    }
  };
  const layout = go(nodes["canvas-ROOT"]);
  console.log("cols", columns);
  console.log("layout", layout);
  return { columns, layout, craft_nodes: nodes };
};
