import React, { Fragment } from "react";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { TwoSplit } from "./elements/TwoSplit";

export const layoutToNodes = (layout, query, actions) => {
  //console.log("layoutToNodes", JSON.stringify(layout))
  function toTag(segment, ix) {
    if (segment.type === "blank") {
      return <Text key={ix} text={segment.contents} />;
    } else if (segment.type === "field") {
      return (
        <Field
          key={ix}
          name={segment.field_name}
          fieldview={segment.fieldview}
        />
      );
    } else if (segment.besides) {
      return (
        <TwoSplit
          key={ix}
          leftCols={6}
          left={toTag(segment.besides[0])}
          right={toTag(segment.besides[1])}
        />
      );
    } else if (segment.above) {
      return segment.above.map((e, ix) => toTag(e, ix));
    } else {
      console.error(segment);
      throw "unrecognized segment";
    }
  }
  function go(segment, parent) {
    if (segment.above) {
      segment.above.forEach(child => {
        go(child, parent);
      });
    } else if (segment.besides) {
      const node = query.createNode(
        <TwoSplit
          leftCols={6}
          left={toTag(segment.besides[0])}
          right={toTag(segment.besides[1])}
        />
      );
      actions.add(node, parent);
    } else {
      const node = query.createNode(toTag(segment));
      //console.log("other", node);
      actions.add(node, parent);
    }
  }
  //const node1 = query.createNode(toTag(layout));
  //actions.add(node1, );
  go(layout, "canvas-ROOT");
};

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
  /*console.log("nodes", nodes);
  console.log("cols", columns);
  console.log("layout", layout);*/
  return { columns, layout };
};
