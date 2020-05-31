import React, { Fragment } from "react";
import { Text } from "./elements/Text";
import { Field } from "./elements/Field";
import { TwoSplit } from "./elements/TwoSplit";
import { JoinField } from "./elements/JoinField";
import { LineBreak } from "./elements/LineBreak";
import { ViewLink } from "./elements/ViewLink";
import { Action } from "./elements/Action";

export const layoutToNodes = (layout, query, actions) => {
  //console.log("layoutToNodes", JSON.stringify(layout));
  function toTag(segment, ix) {
    if (!segment) return;
    if (segment.type === "blank") {
      return <Text key={ix} text={segment.contents} block={segment.block} />;
    } else if (segment.type === "line_break") {
      return <LineBreak />;
    } else if (segment.type === "field") {
      return (
        <Field
          key={ix}
          name={segment.field_name}
          fieldview={segment.fieldview}
          block={segment.block}
        />
      );
    } else if (segment.type === "join_field") {
      return <JoinField key={ix} name={segment.join_field} block={segment.block} />;
    } else if (segment.type === "view_link") {
      return <ViewLink key={ix} name={segment.view} block={segment.block} />;
    } else if (segment.type === "action") {
      return <Action key={ix} name={segment.action_name} block={segment.block} />;
    } else if (segment.besides) {
      return (
        <TwoSplit
          key={ix}
          leftCols={segment.widths ? segment.widths[0] : 6}
          left={toTag(segment.besides[0])}
          right={toTag(segment.besides[1])}
        />
      );
    } else if (segment.above) {
      return segment.above.map((e, ix) => toTag(e, ix));
    }
  }
  function go(segment, parent) {
    if (!segment) return;
    if (segment.above) {
      segment.above.forEach(child => {
        if (child) go(child, parent);
      });
    } else if (segment.besides) {
      const node = query.createNode(
        <TwoSplit
          leftCols={segment.widths ? segment.widths[0] : 6}
          left={toTag(segment.besides[0])}
          right={toTag(segment.besides[1])}
        />
      );
      actions.add(node, parent);
    } else {
      const tag = toTag(segment);
      if (tag) {
        const node = query.createNode(tag);
        //console.log("other", node);
        actions.add(node, parent);
      }
    }
  }
  //const node1 = query.createNode(toTag(layout));
  //actions.add(node1, );
  go(layout, "canvas-ROOT");
};

export const craftToSaltcorn = nodes => {
  //console.log(nodes);
  var columns = [];
  const go = node => {
    if (node.isCanvas) {
      if (node.nodes.length == 0) return;
      else if (node.nodes.length == 1) return go(nodes[node.nodes[0]]);
      else return { above: node.nodes.map(nm => go(nodes[nm])) };
    }
    if (node.displayName === Text.name) {
      return { type: "blank", contents: node.props.text, block: node.props.block };
    }
    if (node.displayName === LineBreak.name) {
      return { type: "line_break" };
    }
    if (node.displayName === TwoSplit.name) {
      return {
        besides: [
          go(nodes[node._childCanvas.Left]),
          go(nodes[node._childCanvas.Right])
        ],
        widths: [node.props.leftCols, 12 - node.props.leftCols]
      };
    }
    if (node.displayName === Field.name) {
      columns.push({
        type: "Field",
        field_name: node.props.name,
        fieldview: node.props.fieldview
      });
      return {
        type: "field",
        block: node.props.block,
        field_name: node.props.name,
        fieldview: node.props.fieldview
      };
    }
    if (node.displayName === JoinField.name) {
      columns.push({
        type: "JoinField",
        join_field: node.props.name
      });
      return {
        type: "join_field",
        block: node.props.block,
        join_field: node.props.name
      };
    }
    if (node.displayName === ViewLink.name) {
      columns.push({
        type: "ViewLink",
        view: node.props.name
      });
      return {
        type: "view_link",
        block: node.props.block,
        view: node.props.name
      };
    }
    if (node.displayName === Action.name) {
      columns.push({
        type: "Action",
        action_name: node.props.name
      });
      return {
        type: "action",
        block: node.props.block,
        action_name: node.props.name
      };
    }
  };
  const layout = go(nodes["canvas-ROOT"]);
  /*console.log("nodes", JSON.stringify(nodes));
  console.log("cols", JSON.stringify(columns));
  console.log("layout", JSON.stringify(layout));*/
  return { columns, layout };
};
